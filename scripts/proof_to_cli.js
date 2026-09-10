#!/usr/bin/env node
// proof_to_cli.js -- pack a snarkjs proof + public.json into stellar-CLI hex args.
// Byte layout MUST match contracts/scripts/convert*.js exactly:
//   proof = G1(pi_a) || G2(pi_b) || G1(pi_c), coords big-endian 32B;
//   G2 order [x1, x0, y1, y0] (Soroban host convention).
// Usage: node scripts/proof_to_cli.js <proof.json> <public.json>
// Prints: PROOF_HEX=<...> \n PUBLIC_JSON=<["hex",...]>
const fs = require("fs");

const [proofPath, pubPath] = process.argv.slice(2);
if (!proofPath || !pubPath) { console.error("usage: proof_to_cli.js <proof.json> <public.json>"); process.exit(1); }

function feBytes(dec) {
  let v = BigInt(dec);
  if (v < 0n) throw new Error("negative field element");
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  if (v !== 0n) throw new Error("field element exceeds 32 bytes: " + dec);
  return out;
}
const concat = (arrs) => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};
const g1Bytes = (pt) => concat([feBytes(pt[0]), feBytes(pt[1])]);
const g2Bytes = (pt) => concat([feBytes(pt[0][1]), feBytes(pt[0][0]), feBytes(pt[1][1]), feBytes(pt[1][0])]);
const toHex = (b) => Buffer.from(b).toString("hex");

const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
const pub = JSON.parse(fs.readFileSync(pubPath, "utf8"));
const proofHex = toHex(concat([g1Bytes(proof.pi_a), g2Bytes(proof.pi_b), g1Bytes(proof.pi_c)]));
console.log("PROOF_HEX=" + proofHex);
console.log("PUBLIC_JSON=" + JSON.stringify(pub.map((s) => toHex(feBytes(s)))));
