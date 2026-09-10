// ---------------------------------------------------------------------------
// gen_keyed_risk_r1.js -- R1 witness vectors for circuits/keyed_risk_r1.circom
// (issue #66). Deterministic keys (sha256 "tessera-keyed-r1-{i}"), real
// Baby-JubJub signatures over M = Poseidon(epoch, balance, nonce), keyed
// acctCommit, recomputed depth-2 Merkle-sum roots.
//
// Vectors (expected witness outcome):
//   V1 PASS-distinct : keys A,B,C,D — [8000,7000,6000,7000], cap 4000
//   V2 EVASION-FAIL  : keys K,K,C,D — [8000,8000,6000,6000], cap 4000
//                      (per-LEAF would PASS at 8000<=11200; per-KEY sums to
//                      16000 > 11200, so the whale split MUST fail)
//   V3 SHARED-OK     : same book as V2, cap 6000 (16000 <= 16800) — MUST pass,
//                      proving the sum (not a same-key ban) is enforced
//   V4 FORGERY-FAIL  : V1 with S[2] bit-flipped — MUST be unprovable
//   V5 THIN-FAIL     : V1 book, reserves 28000 < 29400 floor — MUST fail
//
// Emits build/inputs/keyed_r1_{v1..v5}.json (local, gitignored).
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { buildPoseidon, buildEddsa } = require("circomlibjs");

const DEPTH = 2;
const EPOCH = 0n;
const NONCES = [11n, 22n, 33n, 44n];
const MIN_COLL_BPS = 10500n;

function be32(v) {
  v = BigInt(v);
  if (v < 0n) throw new Error("negative");
  const out = Buffer.alloc(32);
  for (let i = 31; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  if (v !== 0n) throw new Error("overflow 32 bytes");
  return out;
}

(async () => {
  const poseidon = await buildPoseidon();
  const eddsa = await buildEddsa();
  const F = poseidon.F;
  const H = (arr) => F.toObject(poseidon(arr));

  // Five deterministic member keys (K reuses slot-0's key for the shared case).
  const keys = [0, 1, 2, 3].map((i) => {
    const prv = crypto.createHash("sha256").update(`tessera-keyed-r1-${i}`, "ascii").digest();
    const pub = eddsa.prv2pub(prv);
    return { prv, pub, Ax: eddsa.F.toObject(pub[0]), Ay: eddsa.F.toObject(pub[1]) };
  });

  function signLeaf(keyIdx, balance, nonce) {
    const k = keys[keyIdx];
    const Mbig = H([EPOCH, balance, nonce]);
    const sig = eddsa.signPoseidon(k.prv, eddsa.F.e(Mbig));
    if (!eddsa.verifyPoseidon(eddsa.F.e(Mbig), sig, k.pub)) throw new Error("self-verify failed");
    return {
      Ax: k.Ax, Ay: k.Ay,
      S: sig.S,
      R8x: eddsa.F.toObject(sig.R8[0]),
      R8y: eddsa.F.toObject(sig.R8[1]),
    };
  }

  function buildTree(leaves) {
    const leafHash = leaves.map((l) => H([l.acctCommit, l.balance]));
    const leafSum = leaves.map((l) => l.balance);
    let ch = leafHash, cs = leafSum;
    while (ch.length > 1) {
      const nh = [], ns = [];
      for (let i = 0; i < ch.length; i += 2) {
        nh.push(H([ch[i], cs[i], ch[i + 1], cs[i + 1]]));
        ns.push(cs[i] + cs[i + 1]);
      }
      ch = nh; cs = ns;
    }
    return { rootHash: ch[0], rootSum: cs[0] };
  }

  // keyIdx per slot, balances, cap, reserves, tag.
  const VECTORS = {
    v1: { keys: [0, 1, 2, 3], balances: [8000n, 7000n, 6000n, 7000n], cap: 4000n, reserves: 30000n, expect: "PASS" },
    v2: { keys: [0, 0, 2, 3], balances: [8000n, 8000n, 6000n, 6000n], cap: 4000n, reserves: 30000n, expect: "FAIL" },
    v3: { keys: [0, 0, 2, 3], balances: [8000n, 8000n, 6000n, 6000n], cap: 6000n, reserves: 30000n, expect: "PASS" },
    v4: { keys: [0, 1, 2, 3], balances: [8000n, 7000n, 6000n, 7000n], cap: 4000n, reserves: 30000n, expect: "UNPROVABLE", forge: true },
    v5: { keys: [0, 1, 2, 3], balances: [8000n, 7000n, 6000n, 7000n], cap: 4000n, reserves: 28000n, expect: "FAIL" },
  };

  const outDir = path.join(__dirname, "..", "build", "inputs");
  fs.mkdirSync(outDir, { recursive: true });

  for (const [tag, v] of Object.entries(VECTORS)) {
    const signed = v.keys.map((k, i) => signLeaf(k, v.balances[i], NONCES[i]));
    if (v.forge) signed[2].S = (BigInt(signed[2].S) ^ 1n);
    const leaves = v.keys.map((k, i) => {
      const acctCommit = H([keys[k].Ax, keys[k].Ay, NONCES[i]]);
      return { acctCommit, balance: v.balances[i] };
    });
    const tree = buildTree(leaves);
    const input = {
      rootHash: tree.rootHash,
      totalLiabilities: tree.rootSum,
      reserves: v.reserves,
      epoch: EPOCH,
      Ax: signed.map((s) => s.Ax),
      Ay: signed.map((s) => s.Ay),
      maxConcBps: v.cap,
      minCollBps: MIN_COLL_BPS,
      balances: v.balances,
      nonces: NONCES,
      S: signed.map((s) => s.S),
      R8x: signed.map((s) => s.R8x),
      R8y: signed.map((s) => s.R8y),
    };
    fs.writeFileSync(path.join(outDir, `keyed_r1_${tag}.json`),
      JSON.stringify(input, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2));
    console.log(`${tag}: root=${tree.rootHash.toString().slice(0, 20)}… total=${tree.rootSum} expect=${v.expect}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
