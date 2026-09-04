// check_keyed_risk.js -- off-circuit sanity checker for keyed-risk inputs (issue #11).
// Verifies reserves ratio + per-position cap in plain JS before witness gen.
// Usage: node scripts/check_keyed_risk.js <input.json>
const fs = require("fs");
const f = process.argv[2];
if (!f) { console.error("usage: check_keyed_risk.js <input.json>"); process.exit(1); }
const j = JSON.parse(fs.readFileSync(f, "utf8"));
const bals = j.balances.map(BigInt);
const total = bals.reduce((a, b) => a + b, 0n);
const reserves = BigInt(j.reserves);
const maxConc = BigInt(j.maxConcBps);
const minColl = BigInt(j.minCollBps);
let ok = true;
if (total > reserves) { console.error(`FAIL solvency: total ${total} > reserves ${reserves}`); ok = false; }
for (let i = 0; i < bals.length; i++) {
  if (bals[i] * 10000n > maxConc * total) { console.error(`FAIL concentration: leaf ${i} ${bals[i]} exceeds ${maxConc}bps of ${total}`); ok = false; }
}
if (reserves * 10000n < minColl * total) { console.error(`FAIL collateral: ${reserves} < ${minColl}bps of ${total}`); ok = false; }
console.log(ok ? "PASS: keyed-risk input satisfies health + caps (off-circuit)" : "REJECT: see FAIL lines");
process.exit(ok ? 0 : 2);
