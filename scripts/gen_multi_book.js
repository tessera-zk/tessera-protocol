// ---------------------------------------------------------------------------
// gen_multi_book.js -- fresh base-solvency book for the LIVE two-signer
// multi-holder attestation (#59).
//
// Same 16-account balances as scripts/gen_input.js (total 184140, reserves
// 189140 <= the 200000 two-leg live aggregate), but DIFFERENT per-account
// salts (0xbeef0000 base), so the Merkle-sum root is FRESH: the canonical
// epoch-0 root is already attested on-chain and the seen-root guard would
// reject a replay. Tree math identical to circuits/lib/merkle_sum.circom.
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { buildPoseidon } = require("circomlibjs");

const DEPTH = 4;
const N_LEAVES = 1 << DEPTH;

const BALANCES = [
  1500n, 250n, 9999n, 42n,
  100000n, 7n, 3333n, 88n,
  12000n, 640n, 5n, 275n,
  8800n, 1n, 45000n, 2200n,
];

buildPoseidon().then((poseidon) => {
  const F = poseidon.F;
  const H = (arr) => F.toObject(poseidon(arr));

  // Fresh salts => fresh acctCommits => fresh root (balances unchanged).
  const acctCommit = [];
  for (let i = 0; i < N_LEAVES; i++) {
    acctCommit.push(H([BigInt(100000 + i), BigInt(0xbeef0000 + i * 7)]));
  }

  function buildTree(balances) {
    const leafHash = balances.map((b, i) => H([acctCommit[i], b]));
    const leafSum = balances.slice();
    const levels = [{ hash: leafHash, sum: leafSum }];
    let curHash = leafHash, curSum = leafSum;
    while (curHash.length > 1) {
      const nextHash = [], nextSum = [];
      for (let i = 0; i < curHash.length; i += 2) {
        nextHash.push(H([curHash[i], curSum[i], curHash[i + 1], curSum[i + 1]]));
        nextSum.push(curSum[i] + curSum[i + 1]);
      }
      levels.push({ hash: nextHash, sum: nextSum });
      curHash = nextHash; curSum = nextSum;
    }
    return { levels, rootHash: curHash[0], rootSum: curSum[0] };
  }

  const t = buildTree(BALANCES);
  const total = t.rootSum;
  const reserves = total + 5000n; // 189140 <= 200000 live aggregate

  const outDir = path.join(__dirname, "..", "build", "inputs");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "solvency_multi.json"),
    JSON.stringify(
      { rootHash: t.rootHash, totalLiabilities: total, reserves, balances: BALANCES, acctCommit },
      (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)
  );

  console.log("multi-holder book built: root =", t.rootHash.toString());
  console.log("  total =", total.toString(), " reserves =", reserves.toString());
}).catch((e) => { console.error(e); process.exit(1); });
