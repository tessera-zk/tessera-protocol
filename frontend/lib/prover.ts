// ---------------------------------------------------------------------------
// prover.ts -- Real client-side Groth16 proving with snarkjs (WASM).
//
// The witness + proof are computed entirely in the browser. The private
// balances never leave the tab: only the resulting proof and the public signals
// (rootHash, totalLiabilities, reserves / leafCommitment) are sent on-chain.
//
// An unsatisfiable constraint (negative balance range check, or the
// liabilities <= reserves check) throws during witness generation -- there is
// no proof to produce, which is precisely the security property. We surface a
// specific, honest error for each case.
// ---------------------------------------------------------------------------

import { proofToBytes, signalsToBytes } from "./convert";
import type { SolvencyInput, InclusionInput } from "./merkle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let snarkjsPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSnarkjs(): Promise<any> {
  if (!snarkjsPromise) snarkjsPromise = import("snarkjs");
  return snarkjsPromise;
}

const WASM = {
  solvency: "/circuits/solvency.wasm",
  inclusion: "/circuits/inclusion.wasm",
};
const ZKEY = {
  solvency: "/circuits/solvency_final.zkey",
  inclusion: "/circuits/inclusion_final.zkey",
};

export type ProofResult = {
  proofBytes: Uint8Array; // 256 bytes for the Soroban contract
  publicSignals: string[]; // decimal strings, contract-facing order
  signalBytes: Uint8Array[]; // each 32-byte BE
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawProof: any;
};

export class WitnessError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "negative-balance"
      | "insolvent"
      | "wrong-balance"
      | "unknown",
  ) {
    super(message);
    this.name = "WitnessError";
  }
}

function classifyWitnessFailure(err: unknown, circuit: "solvency" | "inclusion"): WitnessError {
  const msg = String((err as Error)?.message ?? err);
  // snarkjs surfaces the failing circom assert line in the error text.
  if (circuit === "solvency") {
    // Num2Bits range check (line ~38 in the compiled sym) => a negative leaf.
    if (/Num2Bits|line: ?3[0-9]|Assert Failed/i.test(msg) && /38|Num2Bits/i.test(msg)) {
      return new WitnessError(
        "Rejected: a leaf balance is negative. The circuit's per-leaf range proof (Num2Bits) makes the Mt. Gox / FTX negative-balance forgery unrepresentable, so no proof can be produced.",
        "negative-balance",
      );
    }
    if (/LessEqThan|line: ?8[0-9]/i.test(msg)) {
      return new WitnessError(
        "Rejected: total liabilities exceed reserves. The solvency constraint (liabilities <= reserves) is unsatisfiable, so no proof exists. This book is insolvent.",
        "insolvent",
      );
    }
  }
  if (circuit === "inclusion") {
    return new WitnessError(
      "No valid inclusion proof: the balance you entered does not match the committed leaf in the attested root. Only the true balance folds to the on-chain root.",
      "wrong-balance",
    );
  }
  return new WitnessError(
    "Proof generation failed: a circuit constraint is unsatisfiable. " + msg,
    "unknown",
  );
}

async function fullProve(
  input: SolvencyInput | InclusionInput,
  circuit: "solvency" | "inclusion",
): Promise<ProofResult> {
  const snarkjs = await getSnarkjs();
  let out: { proof: unknown; publicSignals: string[] };
  try {
    out = await snarkjs.groth16.fullProve(input, WASM[circuit], ZKEY[circuit]);
  } catch (err) {
    throw classifyWitnessFailure(err, circuit);
  }
  const publicSignals = out.publicSignals.map((s) => String(s));
  return {
    proofBytes: proofToBytes(out.proof),
    publicSignals,
    signalBytes: signalsToBytes(publicSignals),
    rawProof: out.proof,
  };
}

export function proveSolvency(input: SolvencyInput): Promise<ProofResult> {
  return fullProve(input, "solvency");
}

export function proveInclusion(input: InclusionInput): Promise<ProofResult> {
  return fullProve(input, "inclusion");
}

/** Verify a proof locally against the exported verification key (sanity check). */
export async function verifyLocally(
  vkUrl: string,
  publicSignals: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proof: any,
): Promise<boolean> {
  const snarkjs = await getSnarkjs();
  const vk = await fetch(vkUrl).then((r) => r.json());
  return snarkjs.groth16.verify(vk, publicSignals, proof);
}
