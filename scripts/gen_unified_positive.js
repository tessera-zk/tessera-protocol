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
// Epoch override for multi-epoch fixtures (#57): UNIFIED_EPOCH=1 emits
// unified_positive_e1.json (different sigs + root, same keys). Default 0 keeps
// the #55-committed root byte-identical (CI pins it).
const EPOCH = BigInt(process.env.UNIFIED_EPOCH || 0);
const EPOCH_TAG = EPOCH === 0n ? "" : `_e${EPOCH}`;
// Epoch-scoped nonces: identical books per epoch would share one root, and the
// on-chain seen-root guard would fire before the epoch-freshness check —
// useless for the #14 stale-epoch test. Offsetting nonces per epoch gives each
// epoch a distinct root (keys unchanged, so the key pin still passes).
const NONCES = [11n, 22n, 33n, 44n].map((n) => n + EPOCH * 1000n);
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
  write(`unified_positive${EPOCH_TAG}.json`, input);

  // ---- OMISSION variant (#57): drop member C (slot 2), substitute an
  //      issuer-controlled filler key signing the same-shaped leaf. The witness
  //      is SATISFIABLE (all 4 sigs check) so a valid proof exists — but slot-2
  //      public key != registered C key, so the contract key pin REJECTS it
  //      (Error #10). Only emitted for the epoch-0 book (the #10 test book).
  // ---- Public artifact (epoch 0 only): NO private keys, NO raw signatures.
  if (EPOCH === 0n) {
    const fPrv = crypto.createHash("sha256").update("tessera-unified-filler", "ascii").digest();
    const fPub = eddsa.prv2pub(fPrv);
    const fAx = eddsa.F.toObject(fPub[0]);
    const fAy = eddsa.F.toObject(fPub[1]);
    const fBalance = BALANCES[2], fNonce = 999999n;
    const fM = H([EPOCH, fBalance, fNonce]);
    const fSig = eddsa.signPoseidon(fPrv, eddsa.F.e(fM));
    if (!eddsa.verifyPoseidon(eddsa.F.e(fM), fSig, fPub)) throw new Error("filler self-verify failed");
    const fAcct = H([fAx, fAy, fNonce]);
    const omUsers = users.map((u, i) => i === 2
      ? { balance: fBalance, nonce: fNonce, Ax: fAx, Ay: fAy,
          S: fSig.S, R8x: eddsa.F.toObject(fSig.R8[0]), R8y: eddsa.F.toObject(fSig.R8[1]),
          acctCommit: fAcct }
      : { balance: u.balance, nonce: u.nonce, Ax: u.Ax, Ay: u.Ay,
          S: signed[i].S, R8x: signed[i].R8x, R8y: signed[i].R8y, acctCommit: u.acctCommit });
    const omTree = buildTree(omUsers.map((o) => ({ acctCommit: o.acctCommit, balance: o.balance })));
    write("unified_omitted.json", {
      rootHash: omTree.rootHash,
      totalLiabilities: omTree.rootSum,
      reserves: RESERVES,
      epoch: EPOCH,
      Ax: omUsers.map((o) => o.Ax),
      Ay: omUsers.map((o) => o.Ay),
      maxConcBps: MAX_CONC_BPS,
      minCollBps: MIN_COLL_BPS,
      balances: omUsers.map((o) => o.balance),
      nonces: omUsers.map((o) => o.nonce),
      S: omUsers.map((o) => o.S),
      R8x: omUsers.map((o) => o.R8x),
      R8y: omUsers.map((o) => o.R8y),
      acctCommitUnused: omUsers.map(() => 0n),
    });
    console.log("  omitted root =", omTree.rootHash.toString(), "(slot-2 filler key)");
  }

  // Public artifact: NO private keys, NO raw signatures — root, totals, member
  // public keys, and per-leaf message hashes (enough to re-verify off-circuit).
  // Epoch-0 book only: the committed artifact (CI-pinned) must never move.
  if (EPOCH === 0n) {
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
  } // end epoch-0-only artifact

  console.log(`Unified positive-control input built (#55/#57, epoch ${EPOCH}).`);
  console.log("  root  =", tree.rootHash.toString());
  console.log("  total =", totalLiabilities.toString(), " reserves =", RESERVES.toString());
  console.log(`  wrote build/inputs/unified_positive${EPOCH_TAG}.json` + (EPOCH === 0n ? " + contracts/artifacts/unified-positive.json" : ""));
})().catch((e) => { console.error(e); process.exit(1); });
