// oracle_math.test.js — runnable trial of the priced-aggregate math (issue #38).
// Exercises frontend/lib/oracle.ts directly (Node 22 type-stripping, no build).
// Usage: node --test scripts/oracle_math.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");

let oracle, mock;
test("load modules", async () => {
  oracle = await import("../frontend/lib/oracle.ts");
  mock = require("./mock_reflector.js");
  assert.ok(oracle.PRICE_DENOMINATOR === 10_000_000n);
});

test("spot scaling exact: 50000 @ 2.0 = 100000", async () => {
  const { scaleBalance } = oracle;
  assert.equal(scaleBalance(50_000n, { priceNum: 20_000_000n, priceLedger: 100 }, 150), 100_000n);
});

test("fractional price truncates, never rounds up", async () => {
  const { scaleBalance } = oracle;
  // 100 @ 0.1234567 = 12.34567 -> 12
  assert.equal(scaleBalance(100n, { priceNum: 1_234_567n, priceLedger: 100 }, 150), 12n);
});

test("staleness boundary: 100 ledgers passes, 101 rejects", async () => {
  const { scaleBalance, ORACLE_MAX_STALENESS_LEDGERS } = oracle;
  assert.equal(ORACLE_MAX_STALENESS_LEDGERS, 100);
  const q = { priceNum: 10_000_000n, priceLedger: 1000 };
  assert.equal(scaleBalance(7n, q, 1100), 7n);
  assert.throws(() => scaleBalance(7n, q, 1101), /STALE_PRICE/);
});

test("mock stale scenario rejects", async () => {
  const { scaleBalance } = oracle;
  const q = mock.SCENARIOS.stale[0];
  assert.throws(() => scaleBalance(1n, { priceNum: q.priceNum, priceLedger: q.priceLedger }, mock.NOW), /STALE_PRICE/);
});

test("non-positive price rejects (mock negative scenario)", async () => {
  const { scaleBalance } = oracle;
  const q = mock.SCENARIOS.negative[0];
  assert.throws(() => scaleBalance(1n, { priceNum: q.priceNum, priceLedger: q.priceLedger }, mock.NOW), /BAD_PRICE/);
  assert.throws(() => scaleBalance(1n, { priceNum: 0n, priceLedger: mock.NOW }, mock.NOW), /BAD_PRICE/);
});

test("missing price: no quote, no scaling (caller must reject)", async () => {
  assert.equal(mock.SCENARIOS.missing.length, 0);
  // pricedAggregate over zero legs yields 0 — backing nothing, never a default price
  assert.equal(oracle.pricedAggregate([], mock.NOW), 0n);
});

test("two-leg aggregate matches hand computation", async () => {
  const { pricedAggregate } = oracle;
  const legs = [
    { holder: "GA", token: "TA", assetCode: "USDC", balance: 100_000n, quote: { priceNum: 10_000_000n, priceLedger: mock.NOW - 5 } },
    { holder: "GB", token: "TB", assetCode: "XLM", balance: 1_000_000n, quote: { priceNum: 1_234_567n, priceLedger: mock.NOW - 10 } },
  ];
  // 100000*1.0 + 1000000*0.1234567 = 100000 + 123456 = 223456 (truncated)
  assert.equal(pricedAggregate(legs, mock.NOW), 223_456n);
});

test("large balances stay exact (BigInt, no float)", async () => {
  const { scaleBalance } = oracle;
  const big = 2n ** 100n;
  assert.equal(scaleBalance(big, { priceNum: 10_000_000n, priceLedger: 1 }, 2), big);
});
