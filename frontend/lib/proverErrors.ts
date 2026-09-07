// proverErrors.ts — bridge between prover throws and the typed error map (issue #41).
// WitnessError (already classified in prover.ts) maps by kind; every other
// throw falls through to classifyProverError. Pages call toErrorOutcome(err)
// in their catch blocks and render <ErrorBanner code detail />.

import { classifyProverError, type TesseraErrorCode } from "./errors";
import { WitnessError } from "./prover";

const WITNESS_KIND_TO_CODE: Record<string, TesseraErrorCode> = {
  "negative-balance": "NEGATIVE_COMMITMENT",
  insolvent: "UNDERFUNDED",
  "wrong-balance": "FORGED_SIGNATURE",
  unknown: "UNKNOWN",
};

export function toErrorOutcome(err: unknown): { code: TesseraErrorCode; detail: string } {
  const detail = String((err as Error)?.message ?? err);
  if (err instanceof WitnessError) {
    return { code: WITNESS_KIND_TO_CODE[err.kind] ?? "UNKNOWN", detail: err.message };
  }
  return { code: classifyProverError(detail), detail };
}
