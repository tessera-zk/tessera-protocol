pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// keyed_risk_tpl.circom -- PROTOTYPE for per-member concentration (issue #11).
// Merges FIX 1 keyed leaves into the risk circuit: each leaf binds
// acctCommit_i = Poseidon(Ax_i, Ay_i, nonce_i), keys are PUBLIC for on-chain
// pinning, concentration is checked per keyed position.
//
// Status: prototype only. NOT wired to any vkey/contract entrypoint. The
// per-LEAF cap remains the enforced claim until this is audited + deployed.
// Sybil (one human, two keys) is out of scope here -- see audit notes.
// Public signals: [rootHash, totalLiabilities, reserves,
//                  Ax[0..n-1], Ay[0..n-1], maxConcBps, minCollBps]
// ---------------------------------------------------------------------------

include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "merkle_sum.circom";

template KeyedRisk(depth, balanceBits) {
    var nLeaves = 1 << depth;

    signal input rootHash;
    signal input totalLiabilities;
    signal input reserves;
    signal input Ax[nLeaves];
    signal input Ay[nLeaves];
    signal input maxConcBps;
    signal input minCollBps;

    signal input balances[nLeaves];
    signal input nonces[nLeaves];

    var bpsBits = balanceBits + depth + 16 + 1;
    var cmpBits = balanceBits + depth + 1;

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

    component tree = MerkleSumRoot(depth);
    for (var i = 0; i < nLeaves; i++) {
        tree.leafHash[i] <== leafHash[i];
        tree.leafSum[i] <== balances[i];
    }
    tree.rootHash === rootHash;
    tree.rootSum === totalLiabilities;

    component resRange = Num2Bits(cmpBits);
    resRange.in <== reserves;
    component le = LessEqThan(cmpBits);
    le.in[0] <== totalLiabilities;
    le.in[1] <== reserves;
    le.out === 1;

    component concRange = Num2Bits(16);
    concRange.in <== maxConcBps;
    component collRange = Num2Bits(16);
    collRange.in <== minCollBps;

    // Per-KEYED-position concentration (per-member once pinned on-chain).
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
