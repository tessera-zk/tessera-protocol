// mock_reflector.js — deterministic Reflector stand-in (issue #38).
// Returns fixed quotes so the trial is reproducible. NOT a price source:
// every quote is labeled with its scenario, including adversarial ones.
// Usage: node scripts/mock_reflector.js [--scenario all|fresh|stale|negative|missing]
const DEN = 10_000_000n;
const NOW = 50000;

const SCENARIOS = {
  fresh: [
    { assetCode: "USDC", priceNum: 1n * DEN, priceLedger: NOW - 5 },
    { assetCode: "XLM", priceNum: 1_234_567n, priceLedger: NOW - 10 }, // 0.1234567 USDC
  ],
  stale: [
    { assetCode: "USDC", priceNum: 1n * DEN, priceLedger: NOW - 500 },
  ],
  negative: [
    { assetCode: "USDC", priceNum: -1n * DEN, priceLedger: NOW - 5 },
  ],
  missing: [],
};

if (require.main === module) {
  const s = (process.argv.find((a) => a.startsWith("--scenario=")) || "--scenario=all").split("=")[1];
  const out = s === "all" ? SCENARIOS : { [s]: SCENARIOS[s] ?? null };
  if (s !== "all" && !SCENARIOS[s]) { console.error(`unknown scenario: ${s}`); process.exit(1); }
  console.log(JSON.stringify({ currentLedger: NOW, quotes: out }, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
}
module.exports = { SCENARIOS, NOW, DEN };
