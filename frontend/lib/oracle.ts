// oracle.ts — Reflector spike helper (issue #10, off-chain stub).
// No live Reflector calls yet; shapes the priced-aggregate math so the
// frontend is ready when the contract path lands.

export const PRICE_DENOMINATOR = 10_000_000n;
export const ORACLE_MAX_STALENESS_LEDGERS = 100;

export type PricedLeg = { holder: string; token: string; assetCode: string; balance: bigint };
export type PriceQuote = { priceNum: bigint; priceLedger: number };

export function scaleBalance(balance: bigint, quote: PriceQuote, currentLedger: number): bigint {
  if (currentLedger - quote.priceLedger > ORACLE_MAX_STALENESS_LEDGERS) {
    throw new Error("STALE_PRICE: Reflector quote too old for attestation");
  }
  if (quote.priceNum <= 0n) throw new Error("BAD_PRICE: non-positive oracle quote");
  return (balance * quote.priceNum) / PRICE_DENOMINATOR;
}

export function pricedAggregate(
  legs: Array<PricedLeg & { quote: PriceQuote }>,
  currentLedger: number,
): bigint {
  return legs.reduce((sum, l) => sum + scaleBalance(l.balance, l.quote, currentLedger), 0n);
}
