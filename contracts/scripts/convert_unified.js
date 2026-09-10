#!/usr/bin/env node
/**
 * convert_unified.js -- unified-circuit on-chain artifact converter (#57).
 *
 * Encodes the REAL unified Groth16 VK + proofs for the Soroban contract.
 * Public-signal layout is 14 signals (15 IC):
 *   [ rootHash, totalLiabilities, reserves, epoch,
 *     Ax[0..3], Ay[0..3], maxConcBps, minCollBps ]
 *
 * Writes:
 *   contracts/tessera-ledger/src/unified_vk_data.rs   (VK_UNIFIED_SOLVENCY)
 *   contracts/tessera-ledger/src/unified_fixtures.rs   (proofs + keys)
 *   contracts/artifacts/unified-args.json              (hex for stellar CLI)
 *
 * Emits the HONEST epoch-0 proof (verifies + stores), the HONEST epoch-1 proof
 * (distinct root, same keys — for the #14 stale-epoch test), and the OMISSION
 * proof (valid proof whose slot-2 public key is the issuer's filler key, so the
 * contract's key pin REJECTS it on-chain, #10). UNIFIED_REGISTERED_AX/AY are
 * derived directly from the honest proof's public signals so the on-chain pin
 * and the self-registered list are byte-identical.
 */

const fs = require("fs");
const path = require("path");

const PROJECT = path.resolve(__dirname, "../..");
const SRC = path.join(PROJECT, "contracts/tessera-ledger/src");
const ART = path.join(PROJECT, "contracts/artifacts");
fs.mkdirSync(ART, { recursive: true });

const N_LEAVES = 4;
const N_PUBLIC = 14;

function feBytes(dec) {
  let v = BigInt(dec);
  if (v < 0n) throw new Error("negative field element");
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  if (v !== 0n) throw new Error("field element exceeds 32 bytes: " + dec);
  return out;
}
function concat(arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
function g1Bytes(pt) { return concat([feBytes(pt[0]), feBytes(pt[1])]); }
function g2Bytes(pt) {
  const xc0 = pt[0][0], xc1 = pt[0][1], yc0 = pt[1][0], yc1 = pt[1][1];
  return concat([feBytes(xc1), feBytes(xc0), feBytes(yc1), feBytes(yc0)]);
}
function toHex(bytes) { return Buffer.from(bytes).toString("hex"); }
function rustArray(bytes) {
  return "[" + Array.from(bytes).map((b) => "0x" + b.toString(16).padStart(2, "0")).join(", ") + "]";
}
function vkToRust(prefix, vk) {
  const ic = vk.IC.map(g1Bytes);
  let s = "";
  s += `pub const ${prefix}_ALPHA: [u8; 64] = ${rustArray(g1Bytes(vk.vk_alpha_1))};\n`;
  s += `pub const ${prefix}_BETA: [u8; 128] = ${rustArray(g2Bytes(vk.vk_beta_2))};\n`;
  s += `pub const ${prefix}_GAMMA: [u8; 128] = ${rustArray(g2Bytes(vk.vk_gamma_2))};\n`;
  s += `pub const ${prefix}_DELTA: [u8; 128] = ${rustArray(g2Bytes(vk.vk_delta_2))};\n`;
  s += `pub const ${prefix}_IC_LEN: usize = ${ic.length};\n`;
  s += `pub const ${prefix}_IC: [[u8; 64]; ${ic.length}] = [\n`;
  for (const p of ic) s += `    ${rustArray(p)},\n`;
  s += `];\n`;
  return s;
}
function proofBytes(proof) {
  return concat([g1Bytes(proof.pi_a), g2Bytes(proof.pi_b), g1Bytes(proof.pi_c)]);
}
function pubToRust(name, pub) {
  let s = `pub const ${name}: [[u8; 32]; ${pub.length}] = [\n`;
  for (const sig of pub) s += `    ${rustArray(feBytes(sig))},\n`;
  s += `];\n`;
  return s;
}
function keysToRust(name, arr) {
  let s = `pub const ${name}: [[u8; 32]; ${arr.length}] = [\n`;
  for (const v of arr) s += `    ${rustArray(feBytes(v))},\n`;
  s += `];\n`;
  return s;
}

const vk = JSON.parse(fs.readFileSync(path.join(PROJECT, "circuit-keys/vk_unified_solvency.json")));
const proof = JSON.parse(fs.readFileSync(path.join(PROJECT, "build/proofs/unified_pos_proof.json")));
const pub = JSON.parse(fs.readFileSync(path.join(PROJECT, "build/proofs/unified_pos_public.json")));
const e1Proof = JSON.parse(fs.readFileSync(path.join(PROJECT, "build/proofs/unified_pos_e1_proof.json")));
const e1Pub = JSON.parse(fs.readFileSync(path.join(PROJECT, "build/proofs/unified_pos_e1_public.json")));
const omProof = JSON.parse(fs.readFileSync(path.join(PROJECT, "build/proofs/unified_omitted_proof.json")));
const omPub = JSON.parse(fs.readFileSync(path.join(PROJECT, "build/proofs/unified_omitted_public.json")));

for (const [tag, p] of [["honest", pub], ["epoch-1", e1Pub], ["omitted", omPub]]) {
  if (p.length !== N_PUBLIC) throw new Error(`unexpected public signal count (${tag}): ` + p.length);
}
if (vk.IC.length !== N_PUBLIC + 1) throw new Error("unexpected IC length: " + vk.IC.length);
// Both honest books share member keys (epoch-scoped nonces only move the root).
for (let i = 0; i < N_LEAVES; i++) {
  if (e1Pub[4 + i] !== pub[4 + i] || e1Pub[4 + N_LEAVES + i] !== pub[4 + N_LEAVES + i]) {
    throw new Error("epoch-1 keys drifted from epoch-0 keys");
  }
}

// Registered keys are exactly the honest proof's public signer keys:
//   Ax[i] = pub[4+i],  Ay[i] = pub[4+N+i].
const regAx = [], regAy = [];
for (let i = 0; i < N_LEAVES; i++) {
  regAx.push(pub[4 + i]);
  regAy.push(pub[4 + N_LEAVES + i]);
}

// ---- unified_vk_data.rs ----
let vkRs = "";
vkRs += "// Auto-generated by contracts/scripts/convert_unified.js from vk_unified_solvency.json.\n";
vkRs += "// Unified-circuit verification key (14 public signals, 15 IC).\n\n";
vkRs += vkToRust("VK_UNIFIED_SOLVENCY", vk);
fs.writeFileSync(path.join(SRC, "unified_vk_data.rs"), vkRs);

// ---- unified_fixtures.rs ----
const proofB = proofBytes(proof);
const tampered = concat([g1Bytes(proof.pi_c), g2Bytes(proof.pi_b), g1Bytes(proof.pi_c)]);
const e1ProofB = proofBytes(e1Proof);
const omProofB = proofBytes(omProof);

let fx = "";
fx += "// Auto-generated by contracts/scripts/convert_unified.js from the REAL unified\n";
fx += "// proofs (#55 positive control + #57 fixtures). Signer keys AND risk bounds\n";
fx += "// are PUBLIC: [rootHash, totalLiabilities, reserves, epoch,\n";
fx += "//              Ax[0..3], Ay[0..3], maxConcBps, minCollBps] (14 signals).\n\n";
fx += `pub const UNIFIED_SOLVENCY_PROOF: [u8; 256] = ${rustArray(proofB)};\n`;
fx += pubToRust("UNIFIED_SOLVENCY_PUBLIC", pub) + "\n";
fx += `pub const UNIFIED_SOLVENCY_PROOF_TAMPERED: [u8; 256] = ${rustArray(tampered)};\n\n`;
fx += "/// HONEST epoch-1 book: distinct root, SAME member keys. Submit after the\n";
fx += "/// epoch-0 honest proof, then the epoch-0 proof becomes stale (#14).\n";
fx += `pub const UNIFIED_SOLVENCY_E1_PROOF: [u8; 256] = ${rustArray(e1ProofB)};\n`;
fx += pubToRust("UNIFIED_SOLVENCY_E1_PUBLIC", e1Pub) + "\n";
fx += "/// Ordered registered member Baby-JubJub keys (== honest proof public keys).\n";
fx += "/// Each member self-registers (ax, ay) under their own auth; the contract\n";
fx += "/// pins the proof's public keys against this list, position-by-position.\n";
fx += keysToRust("UNIFIED_REGISTERED_AX", regAx);
fx += keysToRust("UNIFIED_REGISTERED_AY", regAy) + "\n";
fx += "/// OMISSION attack: a VALID proof over a book where registered member C was\n";
fx += "/// dropped and an issuer-controlled filler key put in slot C. The contract's\n";
fx += "/// on-chain key pin REJECTS it (RegisteredSetMismatch, #10).\n";
fx += `pub const UNIFIED_SOLVENCY_OMITTED_PROOF: [u8; 256] = ${rustArray(omProofB)};\n`;
fx += pubToRust("UNIFIED_SOLVENCY_OMITTED_PUBLIC", omPub);
fs.writeFileSync(path.join(SRC, "unified_fixtures.rs"), fx);

// ---- CLI hex args ----
const args = {
  note: "REAL unified Groth16 artifacts (#55/#57). Public keys pinned on-chain to the member-self-registered list; risk bounds enforced as public inputs.",
  public_layout: ["rootHash", "totalLiabilities", "reserves", "epoch", "Ax[0..3]", "Ay[0..3]", "maxConcBps", "minCollBps"],
  honest_epoch0: {
    proof_hex: toHex(proofB),
    public_hex: pub.map((s) => toHex(feBytes(s))),
    public_dec: pub,
  },
  honest_epoch1: {
    proof_hex: toHex(e1ProofB),
    public_hex: e1Pub.map((s) => toHex(feBytes(s))),
    public_dec: e1Pub,
  },
  registered_keys: regAx.map((ax, i) => ({
    index: i,
    ax_hex: toHex(feBytes(ax)),
    ay_hex: toHex(feBytes(regAy[i])),
    ax_dec: ax,
    ay_dec: regAy[i],
  })),
  omission: {
    proof_hex: toHex(omProofB),
    public_hex: omPub.map((s) => toHex(feBytes(s))),
    public_dec: omPub,
    note: "valid proof, slot-2 public key is the issuer filler; contract pin rejects it",
  },
  tampered_proof_hex: toHex(tampered),
};
fs.writeFileSync(path.join(ART, "unified-args.json"), JSON.stringify(args, null, 2));

console.log("wrote unified_vk_data.rs, unified_fixtures.rs, unified-args.json");
console.log("proof bytes:", proofB.length, "public sigs:", pub.length, "IC:", vk.IC.length);
