// multiHolder.ts — frontend helper for N-holder aggregate reads (issue #7).
// Same-unit only (FIX 2). No secrets; delegates to stellar.ts contract reads.

import { aggregateReserves, type ReserveLeg } from "./stellar";

export function assertSameUnit(legs: ReserveLeg[]): void {
  for (const leg of legs) {
    if (leg.scaleNum !== 1 || leg.scaleDen !== 1) {
      throw new Error("NON_1TO1_LEG: only same-unit 1:1 legs are supported (Error #13)");
    }
  }
}

export async function multiHolderSummary(legs: ReserveLeg[]): Promise<{
  legCount: number;
  aggregate: bigint | null;
  sameUnit: boolean;
}> {
  try {
    assertSameUnit(legs);
  } catch {
    return { legCount: legs.length, aggregate: null, sameUnit: false };
  }
  try {
    const aggregate = await aggregateReserves();
    return { legCount: legs.length, aggregate, sameUnit: true };
  } catch {
    return { legCount: legs.length, aggregate: null, sameUnit: true };
  }
}
