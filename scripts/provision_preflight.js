// provision_preflight.js — can THIS machine run a depth-N phase-2? (issue #39)
// Read-only checks: disk, RAM, toolchain, ptau-mirror reachability.
// Usage: node scripts/provision_preflight.js [--depth 10]
// Exit 0 = GO, exit 2 = NO-GO with reasons. Grades, never provisions.
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");

const depth = Number((process.argv.find((a) => a.startsWith("--depth=")) || "--depth=10").split("=")[1]);
const accounts = 2 ** depth;
// Calibrated from BENCHMARKS.md: depth-8 = 337k constraints / 2^19 ptau / 29s prove.
const constraints = Math.round(accounts * (337079 / 256));
const power = Math.ceil(Math.log2(constraints));
const ptauGB = { 15: 0.04, 16: 0.08, 19: 0.6, 20: 1.2, 21: 2.3 }[power] ?? 3;
const needDiskGB = Math.ceil(ptauGB * 4); // ptau + zkey + wasm + scratch
const needRamGB = power >= 21 ? 16 : power >= 20 ? 12 : power >= 19 ? 8 : power >= 16 ? 4 : 2;

const reasons = [];
const freeDiskGB = Number(execSync("df -BG . | tail -1 | awk '{print $4}'").toString().replace("G", "").trim());
const freeRamGB = Math.round(os.freemem() / 2 ** 30);
console.log(`depth=${depth} accounts=${accounts} constraints~${constraints} ptau=2^${power} (~${ptauGB}GB)`);
console.log(`need: disk>=${needDiskGB}GB ram>=${needRamGB}GB | have: disk=${freeDiskGB}GB ram=${freeRamGB}GB`);
if (freeDiskGB < needDiskGB) reasons.push(`disk ${freeDiskGB}GB < ${needDiskGB}GB`);
if (freeRamGB < needRamGB) reasons.push(`RAM ${freeRamGB}GB < ${needRamGB}GB (phase-2 is memory-bound)`);
for (const t of ["circom", "snarkjs", "node"]) {
  try { execSync(`which ${t}`, { stdio: "ignore" }); } catch { reasons.push(`missing tool: ${t}`); }
}
if (!fs.existsSync("scripts/ptau_mirror.sh")) reasons.push("ptau_mirror.sh absent");

if (reasons.length) {
  console.error("NO-GO:");
  reasons.forEach((r) => console.error(` - ${r}`));
  console.error("See docs/PROVISIONING-RUNBOOK.md for the provisioned-host path.");
  process.exit(2);
}
console.log("GO: machine can attempt this depth (still honor the CI rule: never fetch 2^21 in CI)");
