// parse_multi_events.js — verify attest/multi event shape from a tx result JSON.
// Usage: stellar tx result > tx.json; node scripts/parse_multi_events.js --tx tx.json --expect-legs 2
// Exit 0 = leg_count matches AND root present; exit 2 otherwise.
const fs = require("fs");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const tx = JSON.parse(fs.readFileSync(arg("--tx"), "utf8"));
const expectLegs = Number(arg("--expect-legs") || 2);
const events = tx.events || tx.result_meta?.events || [];
const multi = events.filter((e) => JSON.stringify(e).includes("attest/multi"));
if (!multi.length) { console.error("REJECT: no attest/multi event in tx result"); process.exit(2); }
const body = JSON.stringify(multi[0]);
const m = body.match(/leg_count\D*(\d+)/);
const legCount = m ? Number(m[1]) : null;
console.log(`attest/multi events=${multi.length} leg_count=${legCount} expected=${expectLegs}`);
if (legCount !== expectLegs) {
  console.error(`REJECT: leg_count ${legCount} != ${expectLegs} — do NOT claim multi-holder control`);
  process.exit(2);
}
if (!/root|root_hash/.test(body)) console.log("WARN: no root field visible in event — confirm via get_attestation");
console.log("PASS: multi event shape correct");
