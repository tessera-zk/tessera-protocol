// priced_aggregate_demo.js — end-to-end mock trial (issue #38).
// Wires mock_reflector fresh quotes into pricedAggregate and prints the
// backing verdict for a declared treasury. Read-only demo, no chain.
// Usage: node scripts/priced_aggregate_demo.js [--treasury 223456]
async function main() {
  const oracle = await import("../frontend/lib/oracle.ts");
  const mock = require("./mock_reflector.js");
  const t = (process.argv.find((a) => a.startsWith("--treasury=")) || "--treasury=223456").split("=")[1];
  const treasury = BigInt(t);
  const byAsset = Object.fromEntries(mock.SCENARIOS.fresh.map((q) => [q.assetCode, q]));
  const legs = [
    { holder: "GA...", token: "USDC-SAC", assetCode: "USDC", balance: 100_000n, quote: byAsset.USDC },
    { holder: "GB...", token: "XLM-SAC", assetCode: "XLM", balance: 1_000_000n, quote: byAsset.XLM },
  ];
  const agg = oracle.pricedAggregate(legs, mock.NOW);
  console.log(`aggregate=${agg} treasury=${treasury} ledger=${mock.NOW}`);
  console.log(treasury <= agg ? "BACKED: treasury <= priced aggregate" : "UNBACKED: lower declared treasury (would be rejected on-chain)");
}
main().catch((e) => { console.error("DEMO FAIL:", e.message); process.exit(1); });
