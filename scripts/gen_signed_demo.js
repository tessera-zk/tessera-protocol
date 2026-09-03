// ---------------------------------------------------------------------------
// gen_signed_demo.js  --  UPGRADE 1 (proof-of-liabilities NON-OMISSION) demo.
//
// Builds a real 16-leaf Merkle-sum tree where 4 leaves are USER-SIGNED accounts
// (A,B,C,D) and the rest are zero-balance fillers, plus an OMITTED variant of
// the same tree in which user C's leaf is dropped (replaced by a filler). Each
// user signs — with a real ed25519 key (the curve Stellar accounts use) — a
// canonical message binding (epoch, balance, nonce, their exact leaf
// commitment). The Soroban contract re-verifies those signatures on-chain, so:
//   * the issuer cannot fabricate a leaf a user never signed, and
//   * the issuer cannot downgrade a user's balance (the sig covers it),
// which is what turns "issuer omits accounts to shrink liabilities" into a
// detectable, cryptographically provable event.
//
// Emits witness inputs for three proofs (honest solvency, omitted solvency,
// user-C inclusion in the honest tree) and artifacts/signed-demo.json carrying
// the ed25519 signed leaves (for both epoch 0 and epoch 1) plus a forged leaf.
//
// Poseidon hashing MUST match circuits/lib/merkle_sum.circom exactly (same as
// scripts/gen_input.js): acctCommit=Poseidon(a,b); leaf=Poseidon(acctCommit,bal);
// parent=Poseidon(Lh,Ls,Rh,Rs), parent.sum=Ls+Rs.
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { buildPoseidon } = require("circomlibjs");

const DEPTH = 4;
const N_LEAVES = 1 << DEPTH; // 16
const BN254_P =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const LEAF_DOMAIN = Buffer.from("TESSERA-MEMBER-V1", "ascii"); // 17 bytes

// 32-byte big-endian encoding of a field element / integer (matches the
// contract's BytesN<32> and convert.js feBytes).
function be32(v) {
  v = BigInt(v);
  if (v < 0n) throw new Error("negative");
  const out = Buffer.alloc(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  if (v !== 0n) throw new Error("overflow 32 bytes");
  return out;
}
const be4 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};
const be8 = (n) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(n));
  return b;
};
// i128 balance as 16-byte big-endian (non-negative), matching Rust i128::to_be_bytes.
function be16(v) {
  v = BigInt(v);
  if (v < 0n) throw new Error("negative balance");
  const b = Buffer.alloc(16);
  for (let i = 15; i >= 0; i--) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  if (v !== 0n) throw new Error("balance overflow 16 bytes");
  return b;
}

// Raw 32-byte ed25519 public key from a Node KeyObject (last 32 bytes of SPKI).
function rawPub(publicKey) {
  const der = publicKey.export({ type: "spki", format: "der" });
  return der.subarray(der.length - 32);
}

// The four signed users: {name, index, balance}. C (index 2) is the one an
// omitting issuer will try to drop.
const USERS = [
  { name: "A", index: 0, balance: 5000n },
  { name: "B", index: 1, balance: 12000n },
  { name: "C", index: 2, balance: 8000n },
  { name: "D", index: 3, balance: 3000n },
];
const RESERVE_BUFFER = 2000n; // reserves = honest total + buffer

buildPoseidon().then((poseidon) => {
  const F = poseidon.F;
  const H = (arr) => F.toObject(poseidon(arr));

  // Assign each user an ed25519 keypair and derive a field-domain account id
  // from their public key, then acctCommit = Poseidon(pubkeyField, nonce).
  const users = USERS.map((u, i) => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const pub = rawPub(publicKey); // 32 bytes
    const pubkeyField = BigInt("0x" + pub.toString("hex")) % BN254_P;
    const nonce = 1000n + BigInt(i); // per-user per-epoch nonce (demo)
    const acctCommit = H([pubkeyField, nonce]);
    const leafCommit = H([acctCommit, u.balance]);
    return { ...u, publicKey, privateKey, pub, pubkeyField, nonce, acctCommit, leafCommit };
  });

  // Filler leaves: zero balance, distinct commitments so the tree is well-formed.
  function fillerAcctCommit(i) {
    return H([BigInt(0xf1110000 + i), BigInt(0xba5e0000 + i)]);
  }

  // Build a 16-leaf tree from an array of {acctCommit, balance} leaves, keeping
  // every level so we can extract an inclusion co-path.
  function buildTree(leaves) {
    const leafHash = leaves.map((l) => H([l.acctCommit, l.balance]));
    const leafSum = leaves.map((l) => l.balance);
    const levels = [{ hash: leafHash, sum: leafSum }];
    let curHash = leafHash, curSum = leafSum;
    while (curHash.length > 1) {
      const nh = [], ns = [];
      for (let i = 0; i < curHash.length; i += 2) {
        nh.push(H([curHash[i], curSum[i], curHash[i + 1], curSum[i + 1]]));
        ns.push(curSum[i] + curSum[i + 1]);
      }
      levels.push({ hash: nh, sum: ns });
      curHash = nh; curSum = ns;
    }
    return { levels, rootHash: curHash[0], rootSum: curSum[0] };
  }

  // Assemble the honest leaf set (users at their indices, fillers elsewhere).
  function leafSet(omitIndex) {
    const arr = [];
    for (let i = 0; i < N_LEAVES; i++) {
      const u = users.find((x) => x.index === i);
      if (u && i !== omitIndex) {
        arr.push({ acctCommit: u.acctCommit, balance: u.balance });
      } else {
        arr.push({ acctCommit: fillerAcctCommit(i), balance: 0n });
      }
    }
    return arr;
  }

  const honest = buildTree(leafSet(-1));
  const omitted = buildTree(leafSet(2)); // drop user C (index 2)

  const honestTotal = honest.rootSum;
  const omittedTotal = omitted.rootSum;
  const reserves = honestTotal + RESERVE_BUFFER; // same reserves figure for both

  // ---- witness inputs ----
  const outDir = path.join(__dirname, "..", "build", "inputs");
  fs.mkdirSync(outDir, { recursive: true });
  const write = (name, obj) =>
    fs.writeFileSync(
      path.join(outDir, name),
      JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)
    );

  const solvencyInput = (tree, total) => ({
    rootHash: tree.rootHash,
    totalLiabilities: total,
    reserves,
    balances: tree.levels[0].sum,
    acctCommit: leafSetAcct(tree),
  });
  // We need per-leaf acctCommit for the solvency witness; recompute from the set.
  function leafSetAcct(tree) {
    // reconstruct: the tree was built from a leafSet; recompute acctCommit list.
    return tree === honest
      ? leafSet(-1).map((l) => l.acctCommit)
      : leafSet(2).map((l) => l.acctCommit);
  }

  write("demo_solvency.json", solvencyInput(honest, honestTotal));
  write("demo_solvency_omitted.json", solvencyInput(omitted, omittedTotal));

  // Inclusion co-path for user C (index 2) in the HONEST tree.
  const idx = 2;
  const siblingHash = [], siblingSum = [], pathIndex = [];
  let j = idx;
  for (let level = 0; level < DEPTH; level++) {
    const isRight = j & 1;
    const sib = isRight ? j - 1 : j + 1;
    siblingHash.push(honest.levels[level].hash[sib]);
    siblingSum.push(honest.levels[level].sum[sib]);
    pathIndex.push(BigInt(isRight));
    j = j >> 1;
  }
  write("demo_inclusion.json", {
    rootHash: honest.rootHash,
    leafCommitment: users[idx].leafCommit,
    balance: users[idx].balance,
    acctCommit: users[idx].acctCommit,
    siblingHash,
    siblingSum,
    pathIndex,
  });

  // ---- ed25519 signed leaves (epoch 0 and epoch 1) ----
  function canonicalMsg(epoch, balance, nonce, leafCommit) {
    return Buffer.concat([
      LEAF_DOMAIN,
      be4(epoch),
      be16(balance),
      be8(nonce),
      be32(leafCommit),
    ]);
  }
  function signLeaf(u, epoch) {
    const msg = canonicalMsg(epoch, u.balance, u.nonce, u.leafCommit);
    const sig = crypto.sign(null, msg, u.privateKey); // raw 64-byte ed25519
    // sanity self-check
    if (!crypto.verify(null, msg, u.publicKey, sig)) throw new Error("self-verify failed");
    return {
      name: u.name,
      pubkey_hex: u.pub.toString("hex"),
      balance: u.balance.toString(),
      nonce: u.nonce.toString(),
      leaf_commitment_hex: be32(u.leafCommit).toString("hex"),
      leaf_commitment_dec: u.leafCommit.toString(),
      sig_hex: sig.toString("hex"),
    };
  }

  const epoch0 = users.map((u) => signLeaf(u, 0)); // honest: all four
  const epoch1 = users.map((u) => signLeaf(u, 1)); // omission epoch: all sign, issuer drops C

  // A forged leaf: user C's epoch-0 leaf with one signature byte flipped. The
  // contract's on-chain ed25519_verify must reject this (issuer cannot fabricate).
  const forged = JSON.parse(JSON.stringify(epoch0[2]));
  const fb = Buffer.from(forged.sig_hex, "hex");
  fb[10] ^= 0x01;
  forged.sig_hex = fb.toString("hex");
  forged.note = "user C epoch-0 signature with byte 10 flipped -> must be rejected on-chain";

  const artDir = path.join(__dirname, "..", "contracts", "artifacts");
  fs.mkdirSync(artDir, { recursive: true });
  const manifest = {
    note: "UPGRADE 1 signed-leaf demo. ed25519 (Stellar-key curve) signed liability leaves; verified on-chain by register_signed_leaves / verify_signed_claim.",
    depth: DEPTH,
    honest: { rootHash_dec: honest.rootHash.toString(), totalLiabilities: honestTotal.toString(), reserves: reserves.toString() },
    omitted: { rootHash_dec: omitted.rootHash.toString(), totalLiabilities: omittedTotal.toString(), reserves: reserves.toString(), dropped_user: "C", dropped_index: 2 },
    inclusion_user: "C",
    inclusion_leaf_commitment_dec: users[idx].leafCommit.toString(),
    epoch0_signed_leaves: epoch0,
    epoch1_signed_leaves: epoch1,
    forged_leaf: forged,
  };
  fs.writeFileSync(path.join(artDir, "signed-demo.json"), JSON.stringify(manifest, null, 2));

  console.log("Signed-leaf demo built.");
  console.log("  honest root   =", honest.rootHash.toString(), "total=", honestTotal.toString());
  console.log("  omitted root  =", omitted.rootHash.toString(), "total=", omittedTotal.toString(), "(user C dropped)");
  console.log("  reserves      =", reserves.toString());
  console.log("  user C leaf   =", users[idx].leafCommit.toString());
  console.log("  wrote build/inputs/demo_*.json and contracts/artifacts/signed-demo.json");
}).catch((e) => { console.error(e); process.exit(1); });
