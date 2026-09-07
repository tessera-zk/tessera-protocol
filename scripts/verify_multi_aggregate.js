// verify_multi_aggregate.js — off-chain aggregate preview (no fees spent).
// Confirms treasury <= sum(live balances) BEFORE submitting.
// Usage: node scripts/verify_multi_aggregate.js --legs legs.json --balances 100000,89140 --treasury 189140
const fs = require("fs");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const legs = JSON.parse(fs.readFileSync(arg("--legs"), "utf8")).legs;
const balances = arg("--balances").split(",").map(BigInt);
const treasury = BigInt(arg("--treasury"));
if (balances.length !== legs.length) { console.error("balances count must match legs count"); process.exit(2); }
if (balances.some((b) => b < 0n)) { console.error("balances must be non-negative"); process.exit(2); }
const aggregate = balances.reduce((a, b) => a + b, 0n);
console.log(`legs=${legs.length} balances=[${balances.join(", ")}] aggregate=${aggregate} treasury=${treasury}`);
if (treasury > aggregate) {
  console.error(`REJECT: treasury ${treasury} exceeds aggregate ${aggregate} — lower declared reserves (else on-chain #5/#15)`);
  process.exit(2);
}
console.log("PASS: treasury backed by previewed aggregate — safe to submit");
