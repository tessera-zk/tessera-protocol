// ---------------------------------------------------------------------------
// gen_input_n.js  --  Parameterized Merkle-sum input generator for the SCALE
// benchmarks. Builds a real Poseidon Merkle-sum tree of depth DEPTH (2^DEPTH
// accounts) with realistic pseudo-random balances and emits the witness input
// for solvency proving. Hashing matches circuits/lib/merkle_sum.circom exactly.
//
//   DEPTH=<n> node scripts/gen_input_n.js
//   -> build/inputs/solvency_d<n>.json   (valid + solvent)
//
// Deterministic (seeded) so runs are reproducible.
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { buildPoseidon } = require("circomlibjs");

const DEPTH = parseInt(process.env.DEPTH || "4", 10);
const N_LEAVES = 1 << DEPTH;

// Deterministic PRNG (mulberry32) so balances are realistic but reproducible.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const H = (arr) => F.toObject(poseidon(arr));

  const rand = mulberry32(0x9e3779b1 ^ DEPTH);

  const balances = new Array(N_LEAVES);
  const acctCommit = new Array(N_LEAVES);
  let total = 0n;
  for (let i = 0; i < N_LEAVES; i++) {
    // realistic single-asset balances: 0 .. ~5,000,000 integer token units
    const b = BigInt(Math.floor(rand() * 5_000_000));
    balances[i] = b;
    total += b;
    const acctId = BigInt(100000 + i);
    const salt = BigInt(0xdead0000 + i * 7);
    acctCommit[i] = H([acctId, salt]);
  }

  // Build the Merkle-sum tree bottom-up.
  let curHash = balances.map((b, i) => H([acctCommit[i], b]));
  let curSum = balances.slice();
  while (curHash.length > 1) {
    const nextHash = [];
    const nextSum = [];
    for (let i = 0; i < curHash.length; i += 2) {
      nextHash.push(H([curHash[i], curSum[i], curHash[i + 1], curSum[i + 1]]));
      nextSum.push(curSum[i] + curSum[i + 1]);
    }
    curHash = nextHash;
    curSum = nextSum;
  }
  const rootHash = curHash[0];
  const rootSum = curSum[0];
  const reserves = rootSum + 5000n; // attested reserves comfortably >= total

  const outDir = path.join(__dirname, "..", "build", "inputs");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `solvency_d${DEPTH}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      { rootHash, totalLiabilities: rootSum, reserves, balances, acctCommit },
      (_, v) => (typeof v === "bigint" ? v.toString() : v)
    )
  );

  // Also emit the public signals in the contract-facing order for on-chain use.
  fs.writeFileSync(
    path.join(outDir, `solvency_d${DEPTH}_public.json`),
    JSON.stringify([rootHash.toString(), rootSum.toString(), reserves.toString()])
  );

  console.log(
    `depth=${DEPTH} leaves=${N_LEAVES} total=${rootSum} reserves=${reserves}`
  );
  console.log(`  rootHash=${rootHash}`);
  console.log(`  wrote ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
