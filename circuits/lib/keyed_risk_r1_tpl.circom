pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// keyed_risk_r1_tpl.circom -- R1 (issue #66): EdDSA-authenticated keyed leaves
// PLUS per-KEY concentration.
//
// The #11 prototype bound acctCommit_i = Poseidon(Ax_i, Ay_i, nonce_i) but never
// verified a signature: keys were ATTRIBUTABLE, not AUTHENTICATED, and the cap
// stayed per-LEAF (a whale splits across leaves under one key to evade it).
//
// This template closes both gaps at once:
//   (1) every leaf carries an in-circuit EdDSAPoseidonVerifier over
//       M = Poseidon(epoch, balance, nonce) (FIX 1 pattern, as in UnifiedSolvency);
//   (2) concentration is enforced per KEY: keySum[i] = Σ_j eq(key_j, key_i) *
//       balances[j], and keySum[i] * 10000 <= maxConcBps * total for every i.
//       Two leaves sharing one key are summed BEFORE the cap — the whale split
//       is unprovable, while distinct keys each get their own allowance.
//
// Public signal order (deliberately UNIFIED-compatible for the future R3
// entrypoint, which mirrors the unified key pin):
//   [rootHash, totalLiabilities, reserves, epoch,
//    Ax[0..n-1], Ay[0..n-1], maxConcBps, minCollBps]
// ---------------------------------------------------------------------------

include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "merkle_sum.circom";

template KeyedRiskR1(depth, balanceBits) {
    var nLeaves = 1 << depth;

    // ---- public inputs ----
    signal input rootHash;
    signal input totalLiabilities;
    signal input reserves;
    signal input epoch;
    signal input Ax[nLeaves];
    signal input Ay[nLeaves];
    signal input maxConcBps;
    signal input minCollBps;

    // ---- private witnesses ----
    signal input balances[nLeaves];
    signal input nonces[nLeaves];
    signal input S[nLeaves];
    signal input R8x[nLeaves];
    signal input R8y[nLeaves];

    var bpsBits = balanceBits + depth + 16 + 1;
    var cmpBits = balanceBits + depth + 1;

    // 1. IN-CIRCUIT SIGNATURES (R1 authentication half).
    component msg[nLeaves];
    component sig[nLeaves];
    for (var i = 0; i < nLeaves; i++) {
        msg[i] = Poseidon(3);
        msg[i].inputs[0] <== epoch;
        msg[i].inputs[1] <== balances[i];
        msg[i].inputs[2] <== nonces[i];

        sig[i] = EdDSAPoseidonVerifier();
        sig[i].enabled <== 1;
        sig[i].Ax <== Ax[i];
        sig[i].Ay <== Ay[i];
        sig[i].S <== S[i];
        sig[i].R8x <== R8x[i];
        sig[i].R8y <== R8y[i];
        sig[i].M <== msg[i].out;
    }

    // 2. NON-NEGATIVITY + KEYED LEAF COMMITMENTS.
    component rng[nLeaves];
    component acct[nLeaves];
    component leaf[nLeaves];
    signal leafHash[nLeaves];
    for (var i = 0; i < nLeaves; i++) {
        rng[i] = Num2Bits(balanceBits);
        rng[i].in <== balances[i];

        acct[i] = Poseidon(3);
        acct[i].inputs[0] <== Ax[i];
        acct[i].inputs[1] <== Ay[i];
        acct[i].inputs[2] <== nonces[i];

        leaf[i] = Poseidon(2);
        leaf[i].inputs[0] <== acct[i].out;
        leaf[i].inputs[1] <== balances[i];
        leafHash[i] <== leaf[i].out;
    }

    // 3. SUM CORRECTNESS.
    component tree = MerkleSumRoot(depth);
    for (var i = 0; i < nLeaves; i++) {
        tree.leafHash[i] <== leafHash[i];
        tree.leafSum[i] <== balances[i];
    }
    tree.rootHash === rootHash;
    tree.rootSum === totalLiabilities;

    // 4. SOLVENCY.
    component resRange = Num2Bits(cmpBits);
    resRange.in <== reserves;
    component le = LessEqThan(cmpBits);
    le.in[0] <== totalLiabilities;
    le.in[1] <== reserves;
    le.out === 1;

    // 5. PER-KEY CONCENTRATION (R1 aggregation half). eq[i][j] = 1 iff leaf j
    //    shares leaf i's key; keySum[i] adds exactly those balances.
    component eqAx[nLeaves][nLeaves];
    component eqAy[nLeaves][nLeaves];
    signal eq[nLeaves][nLeaves];
    signal keySum[nLeaves];
    // Accumulator rows hoisted: circom forbids signal declarations inside
    // for-scopes, so acc[i][*] is declared at template scope.
    signal acc[nLeaves][nLeaves + 1];
    for (var i = 0; i < nLeaves; i++) {
        for (var j = 0; j < nLeaves; j++) {
            eqAx[i][j] = IsEqual();
            eqAx[i][j].in[0] <== Ax[i];
            eqAx[i][j].in[1] <== Ax[j];
            eqAy[i][j] = IsEqual();
            eqAy[i][j].in[0] <== Ay[i];
            eqAy[i][j].in[1] <== Ay[j];
            eq[i][j] <== eqAx[i][j].out * eqAy[i][j].out;
        }
        // keySum[i] = Σ_j eq[i][j] * balances[j] (each term quadratic).
        acc[i][0] <== 0;
        for (var j = 0; j < nLeaves; j++) {
            acc[i][j + 1] <== acc[i][j] + eq[i][j] * balances[j];
        }
        keySum[i] <== acc[i][nLeaves];
    }

    component concRange = Num2Bits(16);
    concRange.in <== maxConcBps;
    signal concRhs;
    concRhs <== maxConcBps * totalLiabilities;
    component conc[nLeaves];
    for (var i = 0; i < nLeaves; i++) {
        conc[i] = LessEqThan(bpsBits);
        conc[i].in[0] <== keySum[i] * 10000;
        conc[i].in[1] <== concRhs;
        conc[i].out === 1;
    }

    // 6. COLLATERALIZATION FLOOR.
    component collRange = Num2Bits(16);
    collRange.in <== minCollBps;
    component coll = LessEqThan(bpsBits);
    coll.in[0] <== minCollBps * totalLiabilities;
    coll.in[1] <== reserves * 10000;
    coll.out === 1;
}
