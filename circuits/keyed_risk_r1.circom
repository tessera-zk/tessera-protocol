pragma circom 2.2.3;

// Keyed-risk R1 demo instance (issue #66): depth 2 (4 leaves), 64-bit balances.
// EdDSA-authenticated keyed leaves + per-KEY concentration + collateral floor.
// Status: R1 circuit track. Compiled + witness vectors only (no ptau/zkey/vkey
// yet — setup is R6). NOT wired to any contract entrypoint (R3).
// Public signals (unified-compatible order):
//   [rootHash, totalLiabilities, reserves, epoch,
//    Ax[0..3], Ay[0..3], maxConcBps, minCollBps]  (14 signals)

include "./lib/keyed_risk_r1_tpl.circom";

component main {public [rootHash, totalLiabilities, reserves, epoch, Ax, Ay, maxConcBps, minCollBps]} = KeyedRiskR1(2, 64);
