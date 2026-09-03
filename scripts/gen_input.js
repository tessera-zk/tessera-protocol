// ---------------------------------------------------------------------------
// gen_input.js  --  Build a real Merkle-sum tree in JS (Poseidon over BN254,
// identical hashing to the circom circuits) and emit witness input files:
//
//   build/inputs/solvency_input.json            valid + solvent  (proof succeeds)
//   build/inputs/solvency_insolvent.json        reserves < total (solvency fails)
//   build/inputs/solvency_negbalance.json       one negative leaf (range fails)
//   build/inputs/inclusion_input.json           valid inclusion for one account
//
// The tree math here MUST match circuits/lib/merkle_sum.circom exactly:
//   acctCommit = Poseidon(acctId, salt)
//   leaf.hash  = Poseidon(acctCommit, balance)     leaf.sum = balance
//   parent.hash= Poseidon(Lh, Ls, Rh, Rs)          parent.sum = Ls + Rs
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { buildPoseidon } = require("circomlibjs");

const DEPTH = 4;                 // matches Solvency(4,64) / Inclusion(4,64)
const N_LEAVES = 1 << DEPTH;     // 16
const BN254_P =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// A realistic single-asset liabilities book (16 customer accounts, integer
// token units). These are the PRIVATE balances the issuer never reveals.
const BALANCES = [
  1500n, 250n, 9999n, 42n,
  100000n, 7n, 3333n, 88n,
  12000n, 640n, 5n, 275n,
  8800n, 1n, 45000n, 2200n,
];

function main() {
  return buildPoseidon().then((poseidon) => {
    const F = poseidon.F;
    // Hash helper: accepts BigInt inputs, returns a canonical BigInt field elt.
    const H = (arr) => F.toObject(poseidon(arr));

    // Per-leaf account commitment = Poseidon(acctId, salt). acctId/salt are
    // arbitrary but fixed; salts keep account identity private.
    const acctCommit = [];
    for (let i = 0; i < N_LEAVES; i++) {
      const acctId = BigInt(100000 + i);      // e.g. internal customer id
      const salt = BigInt(0xdead0000 + i * 7); // per-account random salt
      acctCommit.push(H([acctId, salt]));
    }

    // Build the Merkle-sum tree, keeping every node so we can extract an
    // inclusion co-path later.
    function buildTree(balances) {
      const leafHash = balances.map((b, i) => H([acctCommit[i], b]));
      const leafSum = balances.slice();

      const levels = []; // levels[0] = leaves, levels[DEPTH] = [root]
      levels.push({ hash: leafHash, sum: leafSum });

      let curHash = leafHash;
      let curSum = leafSum;
      while (curHash.length > 1) {
        const nextHash = [];
        const nextSum = [];
        for (let i = 0; i < curHash.length; i += 2) {
          nextHash.push(H([curHash[i], curSum[i], curHash[i + 1], curSum[i + 1]]));
          nextSum.push(curSum[i] + curSum[i + 1]);
        }
        levels.push({ hash: nextHash, sum: nextSum });
        curHash = nextHash;
        curSum = nextSum;
      }
      return { levels, rootHash: curHash[0], rootSum: curSum[0] };
    }

    const outDir = path.join(__dirname, "..", "build", "inputs");
    fs.mkdirSync(outDir, { recursive: true });
    const write = (name, obj) =>
      fs.writeFileSync(
        path.join(outDir, name),
        JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)
      );

    // ---- 1. valid + solvent solvency input ----
    const t = buildTree(BALANCES);
    const total = t.rootSum;
    const reserves = total + 5000n; // attested reserves comfortably >= total
    write("solvency_input.json", {
      rootHash: t.rootHash,
      totalLiabilities: total,
      reserves: reserves,
      balances: BALANCES,
      acctCommit: acctCommit,
    });

    // ---- 2. INSOLVENT: same real tree, but reserves < totalLiabilities ----
    //    Range checks all pass; the `liabilities <= reserves` constraint fails.
    write("solvency_insolvent.json", {
      rootHash: t.rootHash,
      totalLiabilities: total,
      reserves: total - 1n, // one unit short => insolvent
      balances: BALANCES,
      acctCommit: acctCommit,
    });

    // ---- 3. NEGATIVE BALANCE: smuggle a field-negative balance (the FTX
    //    attack). We build a *consistent* tree with that value so root/sum
    //    match the witness; only the Num2Bits(64) range check rejects it.
    const negBalances = BALANCES.slice();
    negBalances[6] = BN254_P - 100n; // represents -100 in the field
    const tNeg = buildTree(negBalances);
    write("solvency_negbalance.json", {
      rootHash: tNeg.rootHash,
      totalLiabilities: tNeg.rootSum, // field-reduced sum, internally consistent
      reserves: tNeg.rootSum + 5000n,
      balances: negBalances,
      acctCommit: acctCommit,
    });

    // ---- 4. INCLUSION proof for one real account (index 5) ----
    const idx = 5;
    const siblingHash = [];
    const siblingSum = [];
    const pathIndex = [];
    let j = idx;
    for (let level = 0; level < DEPTH; level++) {
      const isRight = j & 1;            // current node is the right child?
      const sib = isRight ? j - 1 : j + 1;
      siblingHash.push(t.levels[level].hash[sib]);
      siblingSum.push(t.levels[level].sum[sib]);
      pathIndex.push(BigInt(isRight));  // 0 => cur is left, 1 => cur is right
      j = j >> 1;
    }
    const leafCommitment = t.levels[0].hash[idx];
    write("inclusion_input.json", {
      rootHash: t.rootHash,
      leafCommitment: leafCommitment,
      balance: BALANCES[idx],
      acctCommit: acctCommit[idx],
      siblingHash: siblingHash,
      siblingSum: siblingSum,
      pathIndex: pathIndex,
    });

    console.log("Merkle-sum tree built. depth=%d leaves=%d", DEPTH, N_LEAVES);
    console.log("  rootHash         =", t.rootHash.toString());
    console.log("  totalLiabilities =", total.toString());
    console.log("  reserves (valid) =", reserves.toString());
    console.log("  leaf[%d] commit   = %s", idx, leafCommitment.toString());
    console.log("Wrote inputs to", outDir);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
