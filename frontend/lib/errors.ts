// errors.ts — typed prover/contract error map (issue #14).
// Witness-generation failures are the security property surfacing as honest
// errors: a negative, underfunded, whale, forged, or omitted book has NO proof.

export type TesseraErrorCode =
  | "NEGATIVE_COMMITMENT"
  | "UNDERFUNDED"
  | "WHALE_LEAF"
  | "THIN_COLLATERAL"
  | "FORGED_SIGNATURE"
  | "OMITTED_MEMBER"
  | "STALE_EPOCH"
  | "RESERVE_UNBACKED"
  | "MISSING_AUTH"
  | "BAD_RESERVE_LEG"
  | "UNKNOWN";

export function classifyProverError(message: string): TesseraErrorCode {
  const m = message.toLowerCase();
  if (/num2bits|range|negative/.test(m)) return "NEGATIVE_COMMITMENT";
  if (/lesseqthan|underfund|liabilit.*reserv|solvency/.test(m)) return "UNDERFUNDED";
  if (/concentration|whale|maxconc/.test(m)) return "WHALE_LEAF";
  if (/collateral|mincoll/.test(m)) return "THIN_COLLATERAL";
  if (/eddsa|signature|verifier/.test(m)) return "FORGED_SIGNATURE";
  if (/pubkeyhash|registered.*mismatch|#10/.test(m)) return "OMITTED_MEMBER";
  if (/stale.*epoch|#14/.test(m)) return "STALE_EPOCH";
  if (/reserve.*unback|#5/.test(m)) return "RESERVE_UNBACKED";
  if (/require_auth|auth/.test(m)) return "MISSING_AUTH";
  if (/bad.*leg|#13/.test(m)) return "BAD_RESERVE_LEG";
  return "UNKNOWN";
}

const ADVICE: Record<TesseraErrorCode, string> = {
  NEGATIVE_COMMITMENT: "A commitment is negative or out of 64-bit range. Fix the book; no proof can exist for this input.",
  UNDERFUNDED: "Total commitments exceed treasury. Raise reserves or fix the book; the circuit is unsatisfiable.",
  WHALE_LEAF: "A leaf exceeds the concentration cap (per-LEAF, FIX 3). Split is NOT a fix for compliance — see per-member prototype (#11).",
  THIN_COLLATERAL: "Reserves below the min-collateralization floor. Add buffer; the proof is unsatisfiable.",
  FORGED_SIGNATURE: "A leaf signature failed in-circuit verification. Re-sign with the member key; forgery is unprovable.",
  OMITTED_MEMBER: "Proof keys do not match the registered set position-by-position (Error #10). Include every registered member.",
  STALE_EPOCH: "Epoch must strictly increase (Error #14). Use a fresh epoch; replays are rejected.",
  RESERVE_UNBACKED: "Declared treasury exceeds the live on-chain balance (Error #5). Lower declared reserves.",
  MISSING_AUTH: "A required holder signature is absent (require_auth). Add every leg holder's authorization.",
  BAD_RESERVE_LEG: "Non-1:1 reserve leg rejected (Error #13, FIX 2). Use same-unit legs; cross-asset needs Reflector (#10).",
  UNKNOWN: "Proving failed. See logs/prove_run.log pattern and docs/PROVER-ERRORS.md.",
};

export function errorAdvice(code: TesseraErrorCode): string {
  return ADVICE[code];
}
