// ---------------------------------------------------------------------------
// gen_unified_positive.js -- POSITIVE CONTROL for the unified circuit (#55).
//
// Replaces the placeholder zeros in gen_unified_input.js with REAL Baby-JubJub
// keys + EdDSA signatures, a RECOMPUTED Merkle-sum root, and risk bounds that
// actually hold. Output feeds scripts/prove_unified_positive.sh, which proves
// with build/unified/unified_final.zkey (real 2^16 phase-2, #36) and verifies
// against circuit-keys/vk_unified_solvency.json.
//
// Deterministic: private keys derive from sha256("tessera-unified-positive-i")
// so every run yields the same root/total — rerun to reproduce exactly.
//
// Witness shape (must match circuits/lib/unified_solvency_tpl.circom):
//   public : rootHash, totalLiabilities, reserves, epoch,
//            Ax[4], Ay[4], maxConcBps, minCollBps            (14 signals)
//   private: balances[4], nonces[4], S[4], R8x[4], R8y[4], acctCommitUnused[4]
// Message signed per leaf: M = Poseidon(epoch, balance, nonce).
// Keyed leaf: acctCommit = Poseidon(Ax, Ay, nonce);
//             leaf = Poseidon(acctCommit, balance); tree per lib/merkle_sum.
// Risk bounds asserted HERE too (fail fast, before proving):
//   per-leaf balance*10000 <= maxConcBps*total ; minCollBps*total <= reserves*10000
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { buildPoseidon, buildEddsa } = require("circomlibjs");

const DEPTH = 2;
const N_LEAVES = 1 << DEPTH; // 4

const BALANCES = [8000n, 7000n, 6000n, 7000n]; // total 28000
const NONCES = [11n, 22n, 33n, 44n];
const EPOCH = 0n;
const RESERVES = 30000n;
const MAX_CONC_BPS = 4000n; // 40% per-leaf cap: worst leaf 8000/28000 = 28.6%
const MIN_COLL_BPS = 10500n; // 105% floor: 28000*1.05 = 29400 <= 30000

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
  const H = (arr) => F.toObject(poseidon(arr)); // bigint

  // Deterministic member keys: sha256("tessera-unified-positive-{i}").
  const users = BALANCES.map((balance, i) => {
    const prv = crypto.createHash("sha256")
      .update(`tessera-unified-positive-${i}`, "ascii").digest();
    const pub = eddsa.prv2pub(prv);
    const Ax = eddsa.F.toObject(pub[0]);
    const Ay = eddsa.F.toObject(pub[1]);
    const nonce = NONCES[i];
    const acctCommit = H([Ax, Ay, nonce]);
    const leafCommit = H([acctCommit, balance]);
    return { index: i, prv, pub, Ax, Ay, balance, nonce, acctCommit, leafCommit };
  });

  // Sign M = Poseidon(epoch, balance, nonce) with each member key.
  const signed = users.map((u) => {
    const Mbig = H([EPOCH, u.balance, u.nonce]);
    const Mf = eddsa.F.e(Mbig);
    const sig = eddsa.signPoseidon(u.prv, Mf);
    if (!eddsa.verifyPoseidon(Mf, sig, u.pub)) throw new Error(`self-verify failed leaf ${u.index}`);
    return {
      Mbig,
      R8x: eddsa.F.toObject(sig.R8[0]),
      R8y: eddsa.F.toObject(sig.R8[1]),
      S: sig.S,
    };
  });

  // Depth-2 Merkle-sum tree (parent = Poseidon(Lh,Ls,Rh,Rs), sum = Ls+Rs).
  function buildTree(leaves) {
    const leafHash = leaves.map((l) => H([l.acctCommit, l.balance]));
    const leafSum = leaves.map((l) => l.balance);
    const levels = [{ hash: leafHash, sum: leafSum }];
    let ch = leafHash, cs = leafSum;
    while (ch.length > 1) {
      const nh = [], ns = [];
      for (let i = 0; i < ch.length; i += 2) {
        nh.push(H([ch[i], cs[i], ch[i + 1], cs[i + 1]]));
        ns.push(cs[i] + cs[i + 1]);
      }
      levels.push({ hash: nh, sum: ns });
      ch = nh; cs = ns;
    }
    return { levels, rootHash: ch[0], rootSum: cs[0] };
  }

  const tree = buildTree(users.map((u) => ({ acctCommit: u.acctCommit, balance: u.balance })));
  const totalLiabilities = tree.rootSum;

  // Fail fast: risk bounds must hold or the proof is (correctly) unprovable.
  for (const u of users) {
    if (!(u.balance * 10000n <= MAX_CONC_BPS * totalLiabilities)) {
      throw new Error(`concentration violated at leaf ${u.index}`);
    }
  }
  if (!(MIN_COLL_BPS * totalLiabilities <= RESERVES * 10000n)) {
    throw new Error("collateralization floor violated");
  }
  if (!(totalLiabilities <= RESERVES)) throw new Error("insolvent book");

  const input = {
    rootHash: tree.rootHash,
    totalLiabilities,
    reserves: RESERVES,
    epoch: EPOCH,
    Ax: users.map((u) => u.Ax),
    Ay: users.map((u) => u.Ay),
    maxConcBps: MAX_CONC_BPS,
    minCollBps: MIN_COLL_BPS,
    balances: users.map((u) => u.balance),
    nonces: users.map((u) => u.nonce),
    S: signed.map((s) => s.S),
    R8x: signed.map((s) => s.R8x),
    R8y: signed.map((s) => s.R8y),
    acctCommitUnused: users.map(() => 0n),
  };

  const outDir = path.join(__dirname, "..", "build", "inputs");
  fs.mkdirSync(outDir, { recursive: true });
  const write = (name, obj) =>
    fs.writeFileSync(path.join(outDir, name),
      JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  write("unified_positive.json", input);

  // Public artifact: NO private keys, NO raw signatures — root, totals, member
  // public keys, and per-leaf message hashes (enough to re-verify off-circuit).
  const artDir = path.join(__dirname, "..", "contracts", "artifacts");
  fs.mkdirSync(artDir, { recursive: true });
  const manifest = {
    note: "Unified-circuit POSITIVE CONTROL (#55). 4 real Baby-JubJub signatures verified IN-CIRCUIT; keys are public inputs for the future contract key pin (#56). Deterministic: rerun the generator to reproduce byte-identical inputs.",
    depth: DEPTH,
    epoch: EPOCH.toString(),
    rootHash_dec: tree.rootHash.toString(),
    rootHash_hex: be32(tree.rootHash).toString("hex"),
    totalLiabilities: totalLiabilities.toString(),
    reserves: RESERVES.toString(),
    maxConcBps: MAX_CONC_BPS.toString(),
    minCollBps: MIN_COLL_BPS.toString(),
    members: users.map((u, i) => ({
      index: u.index,
      Ax_dec: u.Ax.toString(), Ay_dec: u.Ay.toString(),
      Ax_hex: be32(u.Ax).toString("hex"), Ay_hex: be32(u.Ay).toString("hex"),
      balance: u.balance.toString(), nonce: u.nonce.toString(),
      message_dec: signed[i].Mbig.toString(),
      leaf_commitment_dec: u.leafCommit.toString(),
      leaf_commitment_hex: be32(u.leafCommit).toString("hex"),
    })),
  };
  fs.writeFileSync(path.join(artDir, "unified-positive.json"), JSON.stringify(manifest, null, 2));

  console.log("Unified positive-control input built (#55).");
  console.log("  root  =", tree.rootHash.toString());
  console.log("  total =", totalLiabilities.toString(), " reserves =", RESERVES.toString());
  console.log("  wrote build/inputs/unified_positive.json + contracts/artifacts/unified-positive.json");
})().catch((e) => { console.error(e); process.exit(1); });
