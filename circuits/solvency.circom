pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// solvency.circom  --  Issuer proves the ENTIRE liabilities book is
//   (1) non-negative  (2) sum-correct  (3) solvent, all in zero knowledge.
//
// The Solvency template now lives in lib/solvency_tpl.circom so the SAME code
// can be instantiated at any depth for the scale benchmarks (see BENCHMARKS.md)
// without duplicating a `component main`. This file is the depth-4 demo.
//
// Public signal order (MUST match the Soroban verifier contract):
//   [ rootHash, totalLiabilities, reserves ]
// Field: BN254 scalar field. Hash: circomlib Poseidon.
// ---------------------------------------------------------------------------

include "lib/solvency_tpl.circom";

// Demo instantiation: depth 4 => up to 16 accounts, 64-bit balances.
component main { public [rootHash, totalLiabilities, reserves] } = Solvency(4, 64);
