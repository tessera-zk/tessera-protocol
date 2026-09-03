pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// signed_solvency.circom  --  IN-CIRCUIT EdDSA non-omission demo instantiation.
//
// See lib/signed_solvency_tpl.circom for the full construction. This is the
// depth-2 demo: exactly 4 signed customers (A,B,C,D), every leaf must carry a
// valid Baby-JubJub EdDSA signature, and each leaf's signer key (Ax_i, Ay_i) is
// a PUBLIC input the contract pins to the customer-self-registered key list.
//
// Public signal order (MUST match the Soroban verifier contract):
//   [ rootHash, totalLiabilities, reserves, epoch, Ax[0..3], Ay[0..3] ]
//   = 4 scalars + 4 Ax + 4 Ay = 12 public signals (13 IC points).
// ---------------------------------------------------------------------------

include "lib/signed_solvency_tpl.circom";

// Demo instantiation: depth 2 => exactly 4 signed accounts, 64-bit balances.
component main { public [rootHash, totalLiabilities, reserves, epoch, Ax, Ay] } =
    SignedSolvency(2, 64);
