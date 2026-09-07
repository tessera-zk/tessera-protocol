// collect_holder_auths.js — validate legs + print per-holder signing instructions.
// No keys touched: each holder signs ONLY its own leg auth on its own machine.
// Usage: node scripts/collect_holder_auths.js --legs legs.json --out auths.json
const fs = require("fs");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const legsFile = arg("--legs");
const outFile = arg("--out") || "auths.json";
if (!legsFile) { console.error("usage: collect_holder_auths.js --legs legs.json [--out auths.json]"); process.exit(1); }
const legs = JSON.parse(fs.readFileSync(legsFile, "utf8")).legs;
if (!Array.isArray(legs) || legs.length < 2) { console.error("need >= 2 legs"); process.exit(2); }
legs.forEach((l, i) => {
  if (!l.holder || !l.token) { console.error(`leg ${i}: holder + token required`); process.exit(2); }
  if (l.scale_num !== 1 || l.scale_den !== 1) { console.error(`leg ${i}: non-1:1 scale rejected (#13)`); process.exit(2); }
});

const auths = {
  note: "Each holder authorizes ONLY its own leg. Never share secret keys with the operator.",
  legs: legs.map((l, i) => ({
    index: i,
    holder: l.holder,
    token: l.token,
    instruction: `stellar contract invoke --id $CONTRACT --network testnet --source ${l.holder} -- authorize-leg --leg ${i}`,
    signed: false,
  })),
};
fs.writeFileSync(outFile, JSON.stringify(auths, null, 2));
console.log(`wrote ${outFile} with ${auths.legs.length} per-holder instructions (all unsigned)`);
