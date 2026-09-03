// ---------------------------------------------------------------------------
// stellar.ts -- Real Soroban contract calls against the deployed
// Tessera ledger contract on Stellar testnet (Protocol 27).
//
//   submit_attestation(proof: BytesN<256>, public_signals: Vec<BytesN<32>>) -> u32
//   verify_inclusion(proof, public_signals) -> bool        (read-only simulate)
//   get_attestation() -> Option<Attestation>               (read-only simulate)
//   epoch_count() -> u32                                    (read-only simulate)
//
// Reads run through simulateTransaction (no signature, no fee). The only write
// is submit_attestation, which needs a funded testnet keypair. Receipt polling
// tolerates testnet indexer lag via a bounded retry.
// ---------------------------------------------------------------------------

import {
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  Account,
  BASE_FEE,
  xdr,
  scValToNative,
} from "@stellar/stellar-sdk";

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_TESSERA_CONTRACT_ID ??
  process.env.NEXT_PUBLIC_CONTRACT_ID ??
  "REPLACE_AFTER_DEPLOY";
export const RPC_URL =
  process.env.NEXT_PUBLIC_TESSERA_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://soroban-testnet.stellar.org";
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

// Placeholder source for read-only simulations (a real, funded testnet account;
// simulation ignores its sequence number). Public key only, never a secret.
const READ_SOURCE = "GBZK7Z6DMDBVFOURA76RXRQKPIHXTJFGN6CVRMU3J6ZE55YCZBHG3XG2";

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}
export function horizonTxUrl(hash: string): string {
  return `${HORIZON_URL}/transactions/${hash}`;
}
export function contractUrl(): string {
  return `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`;
}

function server(): rpc.Server {
  return new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });
}

function bytesScVal(bytes: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}
function signalsScVal(signals: Uint8Array[]): xdr.ScVal {
  return xdr.ScVal.scvVec(signals.map(bytesScVal));
}

const LAG_PATTERNS = [
  "not found",
  "could not be found",
  "no matching",
  "missing trie node",
  "receipt",
];
function isLagError(err: unknown): boolean {
  const m = String((err as Error)?.message ?? err).toLowerCase();
  return LAG_PATTERNS.some((p) => m.includes(p));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  { tries = 6, delayMs = 2500, label = "rpc" }: { tries?: number; delayMs?: number; label?: string } = {},
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isLagError(err) || i === tries - 1) throw err;
      console.warn(`[stellar] ${label} lagged (attempt ${i + 1}/${tries}); retrying`, err);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}

async function simulateRead(method: string, ...args: xdr.ScVal[]): Promise<xdr.ScVal> {
  const srv = server();
  const contract = new Contract(CONTRACT_ID);
  const source = new Account(READ_SOURCE, "0");
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await srv.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`${method} simulation failed: ${sim.error}`);
  }
  const retval = sim.result?.retval;
  if (!retval) throw new Error(`${method} returned no value`);
  return retval;
}

export type Attestation = {
  epoch: number;
  rootHashHex: string;
  totalLiabilities: bigint;
  /** ZK-declared treasury (public input the circuit proves >= commitments). */
  reserves: bigint;
  /** Treasury holder whose live token balance backed this attestation. */
  reserveHolder: string;
  /** Token contract (SAC) the reserve balance was read from. */
  reserveToken: string;
  /** Real on-chain balance read cross-contract at submit; enforced >= treasury. */
  boundReserves: bigint;
  /** Ledger sequence at which the on-chain balance was read and bound. */
  boundLedger: number;
  timestamp: number;
  controlProven: boolean;
  nonOmissionInCircuit: boolean;
};

export type CustomerKey = {
  axHex: string;
  ayHex: string;
};

export type RiskAttestation = {
  epoch: number;
  rootHashHex: string;
  totalLiabilities: bigint;
  reserves: bigint;
  maxConcBps: number;
  minCollBps: number;
  reserveHolder: string;
  reserveToken: string;
  boundReserves: bigint;
  boundLedger: number;
  timestamp: number;
};

export type ReserveLeg = {
  holder: string;
  token: string;
  scaleNum: bigint;
  scaleDen: bigint;
};

export type MultiAttestation = {
  epoch: number;
  rootHashHex: string;
  totalLiabilities: bigint;
  reserves: bigint;
  aggregateReserves: bigint;
  legCount: number;
  boundLedger: number;
  timestamp: number;
};

function beHexToBigInt(hex: string): bigint {
  return hex.length ? BigInt("0x" + hex) : 0n;
}
function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesFieldHex(v: unknown): string {
  return bufToHex(new Uint8Array(v as ArrayBufferLike));
}

export async function getAttestation(): Promise<Attestation | null> {
  const retval = await withRetry(() => simulateRead("get_attestation"), {
    label: "get_attestation",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const native: any = scValToNative(retval);
  if (native == null) return null;
  const rootHex = bufToHex(new Uint8Array(native.root_hash));
  const totalHex = bufToHex(new Uint8Array(native.total_liabilities));
  const resHex = bufToHex(new Uint8Array(native.reserves));
  return {
    epoch: Number(native.epoch),
    rootHashHex: rootHex,
    totalLiabilities: beHexToBigInt(totalHex),
    reserves: beHexToBigInt(resHex),
    reserveHolder: String(native.reserve_holder),
    reserveToken: String(native.reserve_token),
    boundReserves: BigInt(native.bound_reserves),
    boundLedger: Number(native.bound_ledger),
    timestamp: Number(native.timestamp),
    controlProven: Boolean(native.control_proven),
    nonOmissionInCircuit: Boolean(native.non_omission_in_circuit),
  };
}

export async function registeredKeyCount(): Promise<number> {
  const retval = await withRetry(() => simulateRead("registered_key_count"), {
    label: "registered_key_count",
  });
  return Number(scValToNative(retval));
}

export async function registeredKeys(): Promise<CustomerKey[]> {
  const retval = await withRetry(() => simulateRead("registered_keys"), {
    label: "registered_keys",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const native: any = scValToNative(retval);
  if (native == null) return [];
  return Array.from(native as unknown[]).map((k) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const key = k as any;
    return {
      axHex: bytesFieldHex(key.ax),
      ayHex: bytesFieldHex(key.ay),
    };
  });
}

export async function signedEpoch(): Promise<number | null> {
  const retval = await withRetry(() => simulateRead("signed_epoch"), {
    label: "signed_epoch",
  });
  const native = scValToNative(retval);
  return native == null ? null : Number(native);
}

export async function getRiskAttestation(): Promise<RiskAttestation | null> {
  const retval = await withRetry(() => simulateRead("get_risk_attestation"), {
    label: "get_risk_attestation",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const native: any = scValToNative(retval);
  if (native == null) return null;
  const rootHex = bytesFieldHex(native.root_hash);
  const totalHex = bytesFieldHex(native.total_liabilities);
  const resHex = bytesFieldHex(native.reserves);
  return {
    epoch: Number(native.epoch),
    rootHashHex: rootHex,
    totalLiabilities: beHexToBigInt(totalHex),
    reserves: beHexToBigInt(resHex),
    maxConcBps: Number(native.max_conc_bps),
    minCollBps: Number(native.min_coll_bps),
    reserveHolder: String(native.reserve_holder),
    reserveToken: String(native.reserve_token),
    boundReserves: BigInt(native.bound_reserves),
    boundLedger: Number(native.bound_ledger),
    timestamp: Number(native.timestamp),
  };
}

export async function reserveLegs(): Promise<ReserveLeg[]> {
  const retval = await withRetry(() => simulateRead("reserve_legs"), {
    label: "reserve_legs",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const native: any = scValToNative(retval);
  if (native == null) return [];
  return Array.from(native as unknown[]).map((l) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leg = l as any;
    return {
      holder: String(leg.holder),
      token: String(leg.token),
      scaleNum: BigInt(leg.scale_num),
      scaleDen: BigInt(leg.scale_den),
    };
  });
}

export async function aggregateReserves(): Promise<bigint> {
  const retval = await withRetry(() => simulateRead("aggregate_reserves"), {
    label: "aggregate_reserves",
  });
  return BigInt(scValToNative(retval) as bigint);
}

export async function getMultiAttestation(): Promise<MultiAttestation | null> {
  const retval = await withRetry(() => simulateRead("get_multi_attestation"), {
    label: "get_multi_attestation",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const native: any = scValToNative(retval);
  if (native == null) return null;
  const rootHex = bytesFieldHex(native.root_hash);
  const totalHex = bytesFieldHex(native.total_liabilities);
  const resHex = bytesFieldHex(native.reserves);
  return {
    epoch: Number(native.epoch),
    rootHashHex: rootHex,
    totalLiabilities: beHexToBigInt(totalHex),
    reserves: beHexToBigInt(resHex),
    aggregateReserves: BigInt(native.aggregate_reserves),
    legCount: Number(native.leg_count),
    boundLedger: Number(native.bound_ledger),
    timestamp: Number(native.timestamp),
  };
}

/**
 * The treasury holder's live balance in the bound token, read right now
 * (cross-contract) via the contract's `live_reserve_balance`. Lets the board
 * show current backing independent of the last attestation.
 */
export async function liveReserveBalance(): Promise<bigint> {
  const retval = await withRetry(() => simulateRead("live_reserve_balance"), {
    label: "live_reserve_balance",
  });
  return BigInt(scValToNative(retval) as bigint);
}

export async function epochCount(): Promise<number> {
  const retval = await withRetry(() => simulateRead("epoch_count"), {
    label: "epoch_count",
  });
  return Number(scValToNative(retval));
}

/** Read-only inclusion check: simulates verify_inclusion and returns the bool. */
export async function verifyInclusion(
  proofBytes: Uint8Array,
  signalBytes: Uint8Array[],
): Promise<boolean> {
  const retval = await withRetry(
    () => simulateRead("verify_inclusion", bytesScVal(proofBytes), signalsScVal(signalBytes)),
    { label: "verify_inclusion" },
  );
  return Boolean(scValToNative(retval));
}

export type SubmitResult = {
  hash: string;
  epoch: number;
  ledger: number;
};

/**
 * Submit a real treasury attestation on-chain. The proof is generated in the
 * browser; signing + submission happen SERVER-SIDE in the /api/submit-attestation
 * route handler, which holds the treasury key (TESSERA_TREASURY_SECRET in .env.local). No
 * signing secret ever reaches the browser bundle. The proof + public signals are
 * sent as hex; the route returns the real tx hash + stored epoch.
 */
export async function submitAttestation(
  proofBytes: Uint8Array,
  signalBytes: Uint8Array[],
): Promise<SubmitResult> {
  const proofHex = bufToHex(proofBytes);
  const signalsHex = signalBytes.map(bufToHex);

  const res = await fetch("/api/submit-attestation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ proofHex, signalsHex }),
  });
  let body: { ok?: boolean; hash?: string; epoch?: number; ledger?: number; error?: string };
  try {
    body = await res.json();
  } catch {
    throw new Error(`submit-attestation returned non-JSON (status ${res.status})`);
  }
  if (!res.ok || !body.ok || !body.hash) {
    throw new Error(body.error ?? `submit-attestation failed (status ${res.status})`);
  }
  return { hash: body.hash, epoch: body.epoch ?? -1, ledger: body.ledger ?? 0 };
}

/** Verify a tx hash resolves as successful on Horizon (independent confirmation). */
export async function confirmOnHorizon(
  hash: string,
): Promise<{ successful: boolean; ledger: number }> {
  const res = await withRetry(
    async () => {
      const r = await fetch(horizonTxUrl(hash));
      if (!r.ok) throw new Error(`Horizon ${r.status} for ${hash}`);
      return r.json();
    },
    { tries: 8, delayMs: 3000, label: "horizon" },
  );
  return { successful: Boolean(res.successful), ledger: Number(res.ledger) };
}