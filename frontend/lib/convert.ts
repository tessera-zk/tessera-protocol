// ---------------------------------------------------------------------------
// convert.ts -- snarkjs Groth16 proof -> Soroban BN254 byte layout.
//
// Byte-for-byte identical to contracts/scripts/convert.js, which is verified
// against Nethermind's soroban-utils encoders and the on-chain contract's
// `from_bytes`:
//
//   Fq/Fr : 32-byte big-endian
//   G1    : x(32) || y(32)                               = 64 bytes
//   G2    : x.c1(32) || x.c0(32) || y.c1(32) || y.c0(32) = 128 bytes  (imag first)
//   Proof : A(G1,64) || B(G2,128) || C(G1,64)           = 256 bytes
//
// snarkjs JSON: G1 = [x,y,"1"]; G2 = [[x_c0,x_c1],[y_c0,y_c1],["1","0"]].
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SnarkProof = any;

function feBytes(dec: string): Uint8Array {
  let v = BigInt(dec);
  if (v < 0n) throw new Error("negative field element");
  const out = new Uint8Array(32); // big-endian
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  if (v !== 0n) throw new Error("field element exceeds 32 bytes: " + dec);
  return out;
}

function concat(arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

// snarkjs G1 [x, y, "1"] -> 64 bytes (x || y).
function g1Bytes(pt: string[]): Uint8Array {
  return concat([feBytes(pt[0]), feBytes(pt[1])]);
}

// snarkjs G2 [[x_c0, x_c1], [y_c0, y_c1], ...] -> 128 bytes.
// Soroban order: x.c1 || x.c0 || y.c1 || y.c0 (imaginary component first).
function g2Bytes(pt: string[][]): Uint8Array {
  const xc0 = pt[0][0],
    xc1 = pt[0][1];
  const yc0 = pt[1][0],
    yc1 = pt[1][1];
  return concat([feBytes(xc1), feBytes(xc0), feBytes(yc1), feBytes(yc0)]);
}

/** snarkjs proof object -> 256-byte Soroban proof (A || B || C). */
export function proofToBytes(proof: SnarkProof): Uint8Array {
  const out = concat([
    g1Bytes(proof.pi_a),
    g2Bytes(proof.pi_b),
    g1Bytes(proof.pi_c),
  ]);
  if (out.length !== 256) {
    throw new Error(`proof encoded to ${out.length} bytes, expected 256`);
  }
  return out;
}

/** snarkjs public signals (decimal strings) -> array of 32-byte BE field elements. */
export function signalsToBytes(publicSignals: string[]): Uint8Array[] {
  return publicSignals.map((s) => feBytes(s));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
