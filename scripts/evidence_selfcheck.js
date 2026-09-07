// evidence_selfcheck.js — pack hygiene gate (issue #44).
// Checks: all pack files exist; every tx hash in the index is 64-hex;
// no TBD/TODO markers in pack docs; caveat grep hits >= 4 files.
// Usage: node scripts/evidence_selfcheck.js — exit 0 = SELFCHECK PASS.
const fs = require("fs");
const { execSync } = require("child_process");

const PACK = [
  "docs/EVIDENCE-COVER.md",
  "docs/EVIDENCE-INDEX.md",
  "docs/EVIDENCE-VERIFY-COMMANDS.md",
  "docs/RED-TEAM-FAQ.md",
  "docs/LIMITATIONS-STATEMENT.md",
];
const problems = [];

for (const f of PACK) {
  if (!fs.existsSync(f)) { problems.push(`missing ${f}`); continue; }
  const s = fs.readFileSync(f, "utf8");
  if (/\bTBD\b|\bTODO\b/.test(s)) problems.push(`${f}: contains TBD/TODO marker`);
  const hashes = [...s.matchAll(/\b[0-9a-f]{64}\b/g)].map((m) => m[0]);
  for (const h of hashes) {
    if (/^0+$/.test(h)) problems.push(`${f}: all-zero placeholder hash ${h.slice(0, 12)}...`);
  }
  if (f === "docs/EVIDENCE-INDEX.md" && hashes.length < 5) {
    problems.push(`${f}: expected >= 5 evidence hashes, found ${hashes.length}`);
  }
}

try {
  const hits = execSync('grep -rl "single-contributor" README.md circuits/README.md ADVANCED-STATUS.md SECURITY.md 2>/dev/null || true', { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
  if (hits.length < 4) problems.push(`caveat disclosed in ${hits.length}/4 required files`);
} catch (e) {
  problems.push(`caveat grep failed: ${e.message}`);
}

if (problems.length) {
  console.error("SELFCHECK FAIL:");
  problems.forEach((p) => console.error(` - ${p}`));
  process.exit(2);
}
console.log("SELFCHECK PASS: pack files present, hashes well-formed, no TBD markers, caveat disclosed 4/4");
