// ---------------------------------------------------------------------------
// gen_signed_incircuit.js  --  UPGRADE 1 STRONGEST FORM: IN-CIRCUIT EdDSA,
// with the adversarial-audit FIX 1 non-omission model.
//
// Builds witness inputs for signed_solvency.circom, whose SNARK verifies each
// customer's Baby-JubJub EdDSA signature INSIDE the proof AND exposes each
// leaf's signer key (Ax_i, Ay_i) as a PUBLIC input. The Soroban contract pins
// those public keys, position-by-position, against an on-chain key list that
// each customer appended UNDER THEIR OWN require_auth. The issuer never authors
// the registered set, so it cannot omit a registered customer.
//
// Emits:
//   build/inputs/signed_solvency.json          honest 4-account book, all signed
//   build/inputs/signed_solvency_omitted.json  drops registered C, substitutes an
//                                               issuer-controlled filler key. This
//                                               is a VALID proof (all 4 sigs check)
//                                               but its public key at slot C != the
//                                               registered C key -> REJECTED ON-CHAIN.
//   build/inputs/signed_solvency_forged.json   forges C's signature -> UNPROVABLE
//                                               (EdDSA verify fails in-circuit).
//   build/inputs/signed_inclusion.json          user C inclusion vs the signed root
//   contracts/artifacts/signed-incircuit.json   registered key set + public signals
//
// The message each user signs is M = Poseidon(epoch, balance, nonce), exactly
// what the circuit recomputes and feeds to EdDSAPoseidonVerifier. acctCommit =
// Poseidon(Ax, Ay, nonce); leaf = Poseidon(acctCommit, balance); tree per
// lib/merkle_sum.circom.
//
// Public signal order (must match signed_solvency.circom + the contract):
//   [ rootHash, totalLiabilities, reserves, epoch, Ax[0..3], Ay[0..3] ]
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { buildPoseidon, buildEddsa } = require("circomlibjs");

const DEPTH = 2;
const N_LEAVES = 1 << DEPTH; // 4

// The four registered customers. C (index 2) is the one an omitting issuer drops.
const USERS = [
  { name: "A", balance: 5000n },
  { name: "B", balance: 12000n },
  { name: "C", balance: 8000n },
  { name: "D", balance: 3000n },
];
const RESERVE_BUFFER = 2000n;
const EPOCH = 0n;

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
  const H = (arr) => F.toObject(poseidon(arr)); // bigint result

  // Build 4 Baby-JubJub keypairs. prv is a 32-byte secret; pub = [Ax, Ay].
  const users = USERS.map((u, i) => {
    const prv = crypto.randomBytes(32);
    const pub = eddsa.prv2pub(prv); // [Ax, Ay] in eddsa.F representation
    const Ax = eddsa.F.toObject(pub[0]);
    const Ay = eddsa.F.toObject(pub[1]);
    const nonce = 1000n + BigInt(i);
    const acctCommit = H([Ax, Ay, nonce]);
    const leafCommit = H([acctCommit, u.balance]);
    return { ...u, index: i, prv, pub, Ax, Ay, nonce, acctCommit, leafCommit };
  });

  // Sign M = Poseidon(epoch, balance, nonce) with each user's key.
  function signUser(u, epoch) {
    const Mbig = H([epoch, u.balance, u.nonce]);
    const Mf = eddsa.F.e(Mbig);
    const sig = eddsa.signPoseidon(u.prv, Mf);
    if (!eddsa.verifyPoseidon(Mf, sig, u.pub)) throw new Error("self-verify failed " + u.name);
    return {
      Mbig,
      R8x: eddsa.F.toObject(sig.R8[0]),
      R8y: eddsa.F.toObject(sig.R8[1]),
      S: sig.S,
    };
  }

  const signed = users.map((u) => ({ u, s: signUser(u, EPOCH) }));

  // Merkle-sum tree over the 4 signed leaves (keep levels for inclusion co-path).
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

  const honestLeaves = users.map((u) => ({ acctCommit: u.acctCommit, balance: u.balance }));
  const tree = buildTree(honestLeaves);
  const totalLiabilities = tree.rootSum;
  const reserves = totalLiabilities + RESERVE_BUFFER;

  const outDir = path.join(__dirname, "..", "build", "inputs");
  fs.mkdirSync(outDir, { recursive: true });
  const write = (name, obj) =>
    fs.writeFileSync(path.join(outDir, name),
      JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));

  // ---- honest witness (all 4 signatures valid, keys = registered set) ----
  const honestInput = {
    rootHash: tree.rootHash,
    totalLiabilities,
    reserves,
    epoch: EPOCH,
    Ax: users.map((u) => u.Ax),
    Ay: users.map((u) => u.Ay),
    balances: users.map((u) => u.balance),
    nonces: users.map((u) => u.nonce),
    S: signed.map((x) => x.s.S),
    R8x: signed.map((x) => x.s.R8x),
    R8y: signed.map((x) => x.s.R8y),
  };
  write("signed_solvency.json", honestInput);

  // ---- OMISSION attack: drop registered user C (index 2) and substitute an
  //      issuer-controlled filler account. The filler is signed by the issuer's
  //      OWN key, so the witness is SATISFIABLE and a valid proof exists. But the
  //      filler's public key at slot C differs from the registered C key, so the
  //      contract's on-chain key pin REJECTS this attestation. ----
  const fillerBalance = 8000n; // same as C so totals look plausible
  const fillerNonce = 999999n;
  const fPrv = crypto.randomBytes(32);
  const fPub = eddsa.prv2pub(fPrv);
  const fAx = eddsa.F.toObject(fPub[0]);
  const fAy = eddsa.F.toObject(fPub[1]);
  const fM = H([EPOCH, fillerBalance, fillerNonce]);
  const fSig = eddsa.signPoseidon(fPrv, eddsa.F.e(fM));
  if (!eddsa.verifyPoseidon(eddsa.F.e(fM), fSig, fPub)) throw new Error("filler self-verify failed");
  const fAcct = H([fAx, fAy, fillerNonce]);

  const omittedUsers = users.map((u, i) => i === 2
    ? { balance: fillerBalance, nonce: fillerNonce, Ax: fAx, Ay: fAy,
        S: fSig.S, R8x: eddsa.F.toObject(fSig.R8[0]), R8y: eddsa.F.toObject(fSig.R8[1]),
        acctCommit: fAcct }
    : { balance: u.balance, nonce: u.nonce, Ax: u.Ax, Ay: u.Ay,
        S: signed[i].s.S, R8x: signed[i].s.R8x, R8y: signed[i].s.R8y, acctCommit: u.acctCommit });
  const omTree = buildTree(omittedUsers.map((o) => ({ acctCommit: o.acctCommit, balance: o.balance })));
  const omittedInput = {
    rootHash: omTree.rootHash,
    totalLiabilities: omTree.rootSum,
    reserves,
    epoch: EPOCH,
    Ax: omittedUsers.map((o) => o.Ax),
    Ay: omittedUsers.map((o) => o.Ay),
    balances: omittedUsers.map((o) => o.balance),
    nonces: omittedUsers.map((o) => o.nonce),
    S: omittedUsers.map((o) => o.S),
    R8x: omittedUsers.map((o) => o.R8x),
    R8y: omittedUsers.map((o) => o.R8y),
  };
  write("signed_solvency_omitted.json", omittedInput);

  // ---- FORGERY attack: honest tree, but flip one bit of C's signature S.
  //      EdDSA verification fails IN-CIRCUIT -> the witness is unsatisfiable and
  //      no proof exists at all. ----
  const forgedInput = JSON.parse(JSON.stringify(honestInput,
    (_, v) => (typeof v === "bigint" ? v.toString() : v)));
  forgedInput.S[2] = (BigInt(forgedInput.S[2]) ^ 1n).toString();
  write("signed_solvency_forged.json", forgedInput);

  // ---- inclusion witness for user C against the SIGNED honest root ----
  const idx = 2;
  const siblingHash = [], siblingSum = [], pathIndex = [];
  let j = idx;
  for (let level = 0; level < DEPTH; level++) {
    const isRight = j & 1;
    const sib = isRight ? j - 1 : j + 1;
    siblingHash.push(tree.levels[level].hash[sib]);
    siblingSum.push(tree.levels[level].sum[sib]);
    pathIndex.push(BigInt(isRight));
    j = j >> 1;
  }
  write("signed_inclusion.json", {
    rootHash: tree.rootHash,
    leafCommitment: users[idx].leafCommit,
    balance: users[idx].balance,
    acctCommit: users[idx].acctCommit,
    siblingHash, siblingSum, pathIndex,
  });

  // ---- public artifact (for the contract + docs) ----
  const artDir = path.join(__dirname, "..", "contracts", "artifacts");
  fs.mkdirSync(artDir, { recursive: true });
  const manifest = {
    note: "UPGRADE 1 IN-CIRCUIT EdDSA + FIX 1 non-omission. Baby-JubJub signatures verified INSIDE the SNARK; each leaf's signer key (Ax,Ay) is a PUBLIC input the contract pins to the CUSTOMER-self-registered ordered key list. Omitting a registered customer yields a valid proof that is REJECTED ON-CHAIN by the key pin; forging a signature is unprovable in-circuit.",
    depth: DEPTH,
    epoch: EPOCH.toString(),
    // ordered registered customer Baby-JubJub keys (what each customer self-registers)
    registered_keys: users.map((u) => ({
      name: u.name, index: u.index,
      Ax_dec: u.Ax.toString(), Ay_dec: u.Ay.toString(),
      Ax_hex: be32(u.Ax).toString("hex"), Ay_hex: be32(u.Ay).toString("hex"),
    })),
    honest: {
      rootHash_dec: tree.rootHash.toString(),
      totalLiabilities: totalLiabilities.toString(),
      reserves: reserves.toString(),
    },
    // the substituted filler key an omitting issuer would present at slot C
    omission_filler_key: { Ax_dec: fAx.toString(), Ay_dec: fAy.toString() },
    users: users.map((u) => ({
      name: u.name, index: u.index,
      Ax_dec: u.Ax.toString(), Ay_dec: u.Ay.toString(),
      balance: u.balance.toString(), nonce: u.nonce.toString(),
      leaf_commitment_dec: u.leafCommit.toString(),
      leaf_commitment_hex: be32(u.leafCommit).toString("hex"),
    })),
    inclusion_user: "C",
    inclusion_leaf_commitment_dec: users[idx].leafCommit.toString(),
  };
  fs.writeFileSync(path.join(artDir, "signed-incircuit.json"), JSON.stringify(manifest, null, 2));

  console.log("IN-CIRCUIT EdDSA signed-solvency inputs built (FIX 1 public-key pin).");
  console.log("  root            =", tree.rootHash.toString());
  console.log("  totalLiabilities=", totalLiabilities.toString(), " reserves=", reserves.toString());
  console.log("  registered keys :", users.map((u) => u.name).join(","));
  console.log("  wrote signed_solvency{,_omitted,_forged}.json, signed_inclusion.json, signed-incircuit.json");
})().catch((e) => { console.error(e); process.exit(1); });
