// estimate_depth10.js -- memory/time estimator for depth-10 (issue #8).
// Uses measured depth-4/depth-8 points from BENCHMARKS.md; linear in leaves.
// Usage: node scripts/estimate_depth10.js

const points = [
  { depth: 4, accounts: 16, constraints: 20511, prove_s: 1, zkey_mb: 5 },
  { depth: 8, accounts: 256, constraints: 337079, prove_s: 29.3, zkey_mb: 148 },
];

function estimate(depth) {
  const accounts = 1 << depth;
  const perAccount = points[1].constraints / points[1].accounts; // ~1317
  const constraints = Math.round(accounts * perAccount);
  // ptau power: next 2^k above constraints
  const power = Math.ceil(Math.log2(constraints));
  const prove = (constraints / points[1].constraints) * points[1].prove_s;
  return { depth, accounts, constraints, power, prove_s: Math.round(prove) };
}

for (const d of [8, 9, 10]) {
  const e = estimate(d);
  console.log(`depth ${e.depth}: accounts=${e.accounts} constraints~${e.constraints} ptau=2^${e.power} prove~${e.prove_s}s`);
}
console.log("note: depth-10 needs 2^21 ptau (~2.3GB) + ~16GB RAM for phase-2; circuit is unchanged (depth-parametric).");
