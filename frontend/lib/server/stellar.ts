// ---------------------------------------------------------------------------
// Server-only Soroban signing + submission for Tessera.
// 
// Runs exclusively inside a Next.js route handler (nodejs runtime). Reads the
// treasury secret from process.env.TESSERA_TREASURY_SECRET at request time. This is NEVER
// exposed to the browser: no NEXT_PUBLIC_ prefix, and this module is never
// imported by a client component (the `server-only` guard makes that a build
// error). The browser generates the Groth16 proof; this module only signs the
// already-formed submit_attestation transaction and submits it, then reports
// the real tx hash + stored epoch. The secret is never logged or returned.
// ---------------------------------------------------------------------------
import "server-only";
import {
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  Keypair,
  BASE_FEE,
  xdr,
  scValToNative,
} from "@stellar/stellar-sdk";

const CONTRACT_ID =
  process.env.CONTRACT_ID ??
  process.env.NEXT_PUBLIC_CONTRACT_ID ??
  process.env.TESSERA_CONTRACT_ID ??
  process.env.NEXT_PUBLIC_TESSERA_CONTRACT_ID ??
  "REPLACE_AFTER_DEPLOY";
const RPC_URL =
  process.env.RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.NEXT_PUBLIC_TESSERA_RPC_URL ??
  "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

function treasuryKeypair(): Keypair {
  const s = process.env.TESSERA_TREASURY_SECRET ?? process.env.ISSUER_SECRET;
  if (!s) {
    throw new Error(
      "TESSERA_TREASURY_SECRET not set. Add it to frontend/.env.local (see .env.example). Never use NEXT_PUBLIC_ for a signing key.",
    );
  }
  return Keypair.fromSecret(s.trim());
}

function server(): rpc.Server {
  return new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  if (clean.length % 2 !== 0) throw new Error("odd-length hex");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
function bytesScVal(bytes: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}
function signalsScVal(signals: Uint8Array[]): xdr.ScVal {
  return xdr.ScVal.scvVec(signals.map(bytesScVal));
}

const LAG_PATTERNS = ["not found", "could not be found", "no matching", "missing trie node", "receipt"];
function isLagError(err: unknown): boolean {
  const m = String((err as Error)?.message ?? err).toLowerCase();
  return LAG_PATTERNS.some((p) => m.includes(p));
}
async function withRetry<T>(
  fn: () => Promise<T>,
  { tries = 12, delayMs = 2500, label = "rpc" }: { tries?: number; delayMs?: number; label?: string } = {},
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isLagError(err) || i === tries - 1) throw err;
      console.warn(`[server/stellar] ${label} lagged (attempt ${i + 1}/${tries}); retrying`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}

export type SubmitResult = { hash: string; epoch: number; ledger: number };

/**
 * Sign and submit a real treasury attestation on-chain with the server-held
 * treasury key. The proof + public signals are produced in the browser and passed
 * in as hex. Preflight (prepareTransaction) verifies the Groth16 proof during
 * simulation, so an invalid proof throws BEFORE any ledger tx is created.
 */
export async function submitAttestation(proofHex: string, signalsHex: string[]): Promise<SubmitResult> {
  const keypair = treasuryKeypair();
  const srv = server();
  const contract = new Contract(CONTRACT_ID);

  const proofBytes = hexToBytes(proofHex);
  const signalBytes = signalsHex.map(hexToBytes);

  const account = await srv.getAccount(keypair.publicKey());
  const built = new TransactionBuilder(account, {
    fee: (BigInt(BASE_FEE) * 1000n).toString(), // headroom for Groth16 CPU cost
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("submit_attestation", bytesScVal(proofBytes), signalsScVal(signalBytes)))
    .setTimeout(120)
    .build();

  let prepared;
  try {
    prepared = await srv.prepareTransaction(built);
  } catch (err) {
    throw new Error(
      "Preflight rejected the attestation. The contract verifies the Groth16 proof during simulation; an invalid proof cannot be submitted. " +
        String((err as Error)?.message ?? err),
    );
  }
  prepared.sign(keypair);

  const sent = await srv.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`sendTransaction ERROR: ${JSON.stringify(sent.errorResult ?? sent)}`);
  }
  const hash = sent.hash;

  const receipt = await withRetry(
    async () => {
      const res = await srv.getTransaction(hash);
      if (res.status === rpc.Api.GetTransactionStatus.NOT_FOUND) throw new Error("receipt not found yet");
      return res;
    },
    { tries: 12, delayMs: 2500, label: "getTransaction" },
  );

  if (receipt.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction ${hash} failed on-chain: ${receipt.status}`);
  }

  let epoch = -1;
  try {
    if (receipt.returnValue) epoch = Number(scValToNative(receipt.returnValue));
  } catch (err) {
    console.error("[server/stellar] failed to decode submit return value", err);
  }
  return { hash, epoch, ledger: receipt.ledger };
}