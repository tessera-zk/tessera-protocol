// membership_check.js -- compare registered list vs proof keys (issue #12).
// Usage: node scripts/membership_check.js registered.json proof_keys.json
// Both files: JSON arrays of {ax, ay} hex strings. Exits 0 if aligned, 2 if not.
const fs = require("fs");
const [regFile, proofFile] = process.argv.slice(2);
if (!regFile || !proofFile) { console.error("usage: membership_check.js registered.json proof_keys.json"); process.exit(1); }
const norm = (k) => `${String(k.ax).toLowerCase()}:${String(k.ay).toLowerCase()}`;
const reg = JSON.parse(fs.readFileSync(regFile, "utf8"));
const proof = JSON.parse(fs.readFileSync(proofFile, "utf8"));
const regSet = new Set(reg.map(norm));
const proofSet = new Set(proof.map(norm));
const missing = reg.filter((k) => !proofSet.has(norm(k)));
const extra = proof.filter((k) => !regSet.has(norm(k)));
const aligned = missing.length === 0 && extra.length === 0 && reg.length === proof.length
  && reg.every((k, i) => norm(k) === norm(proof[i]));
console.log(JSON.stringify({ registered: reg.length, proof: proof.length, missing, extra, aligned }, null, 2));
process.exit(aligned ? 0 : 2);
