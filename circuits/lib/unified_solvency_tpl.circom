pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// unified_solvency_tpl.circom -- SKELETON for NOT-YET #1 (unified circuit).
//
// Combines, in one template:
//   (1) health        from solvency_tpl.circom  (non-negativity, sum, R>=L)
//   (2) non-omission  from signed_solvency_tpl.circom (in-circuit EdDSA + keyed leaves)
//   (3) risk limits   from risk_solvency_tpl.circom   (per-LEAF cap + min collateral)
//
// Status: skeleton / spec track only. Compiles at depth 2. NOT wired to any
// verifier key, contract entrypoint, or testnet deployment. The per-leaf vs
// per-member caveat (FIX 3) still applies: concentration is per-LEAF here.
//
// Public signal order (MUST match future contract):
//   [rootHash, totalLiabilities, reserves, epoch,
//    Ax[0..n-1], Ay[0..n-1], maxConcBps, minCollBps]
// ---------------------------------------------------------------------------

include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "merkle_sum.circom";

template UnifiedSolvency(depth, balanceBits) {
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
    signal input acctCommitUnused[nLeaves]; // reserved: unified uses keyed acctCommit below

    var bpsBits = balanceBits + depth + 16 + 1;
    var cmpBits = balanceBits + depth + 1;

    // 1. IN-CIRCUIT SIGNATURES: M_i = Poseidon(epoch, balances[i], nonces[i]).
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

    // 4. SOLVENCY: totalLiabilities <= reserves.
    component resRange = Num2Bits(cmpBits);
    resRange.in <== reserves;
    component le = LessEqThan(cmpBits);
    le.in[0] <== totalLiabilities;
    le.in[1] <== reserves;
    le.out === 1;

    // 5. RISK: per-LEAF concentration cap + min collateralization (FIX 3 scope).
    component concRange = Num2Bits(16);
    concRange.in <== maxConcBps;
    component collRange = Num2Bits(16);
    collRange.in <== minCollBps;

    signal concRhs;
    concRhs <== maxConcBps * totalLiabilities;
    component conc[nLeaves];
    for (var i = 0; i < nLeaves; i++) {
        conc[i] = LessEqThan(bpsBits);
        conc[i].in[0] <== balances[i] * 10000;
        conc[i].in[1] <== concRhs;
        conc[i].out === 1;
    }

    component coll = LessEqThan(bpsBits);
    coll.in[0] <== minCollBps * totalLiabilities;
    coll.in[1] <== reserves * 10000;
    coll.out === 1;
}
