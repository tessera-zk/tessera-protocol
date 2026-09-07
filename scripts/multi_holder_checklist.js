// multi_holder_checklist.js — pre-submit checks for the two-signer rehearsal.
// No network, no secrets: validates inputs and prints the funding checklist.
// Usage: node scripts/multi_holder_checklist.js --holders GB..A,GB..B [--legs legs.json]
// Exit 0 = proceed; exit 2 = fix listed items first.
const fs = require("fs");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const holders = (arg("--holders") || "").split(",").map((s) => s.trim()).filter(Boolean);
const legsFile = arg("--legs");
const problems = [];

if (holders.length < 2) problems.push("need at least 2 distinct --holders (comma-separated G... addresses)");
if (new Set(holders).size !== holders.length) problems.push("holder addresses must be DISTINCT (single key across legs voids multi-holder control)");
for (const h of holders) {
  if (!/^G[A-Z2-7]{55}$/.test(h)) problems.push(`holder not a valid testnet address: ${h}`);
}
if (legsFile) {
  let legs;
  try {
    legs = JSON.parse(fs.readFileSync(legsFile, "utf8")).legs;
  } catch (e) {
    problems.push(`cannot read legs file: ${e.message}`);
  }
  if (legs) {
    if (legs.length < 2) problems.push("legs file must define >= 2 legs");
    legs.forEach((l, i) => {
      if (l.scale_num !== 1 || l.scale_den !== 1) problems.push(`leg ${i}: non-1:1 scale rejected on-chain (#13)`);
      if (!holders.includes(l.holder)) problems.push(`leg ${i}: holder ${l.holder} not in --holders set`);
    });
  }
}

console.log(`holders: ${holders.length}, distinct: ${new Set(holders).size}`);
console.log("funding checklist: each holder needs stroops for 1x set_reserve_legs share + 1x auth + fee buffer; operator needs nothing.");
if (problems.length) {
  console.error("BLOCKED:");
  problems.forEach((p) => console.error(` - ${p}`));
  process.exit(2);
}
console.log("PASS: rehearsal inputs valid — proceed to collect_holder_auths.js");
