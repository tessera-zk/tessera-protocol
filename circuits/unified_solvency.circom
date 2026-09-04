pragma circom 2.2.3;

// Unified solvency demo instance: depth 2 (4 keyed leaves), 64-bit balances.
// Status: skeleton only (NOT-YET #1). No zkey/vkey generated in this PR.
// Public signals:
//   [rootHash, totalLiabilities, reserves, epoch,
//    Ax[0..3], Ay[0..3], maxConcBps, minCollBps]  (14 signals)

include "./lib/unified_solvency_tpl.circom";

component main {public [rootHash, totalLiabilities, reserves, epoch, Ax, Ay, maxConcBps, minCollBps]} = UnifiedSolvency(2, 64);
