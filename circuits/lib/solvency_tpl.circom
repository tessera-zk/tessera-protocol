pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// solvency_tpl.circom  --  The Solvency template, extracted so it can be
// instantiated at ANY depth (for the scale benchmarks) without duplicating a
// `component main`. `circuits/solvency.circom` includes this and instantiates
// the depth-4 demo; the benchmark harness generates depth-N wrappers that
// include this same template. See circuits/README.md and BENCHMARKS.md.
//
// Proves the ENTIRE liabilities book is:
//   (1) non-negative   every leaf balance in [0, 2^balanceBits)
//   (2) sum-correct     committed Merkle-sum root reproduces from the private
//                       balances, and its carried sum equals totalLiabilities
//   (3) solvent         totalLiabilities <= reserves
// ...all in zero knowledge. Public signals: [rootHash, totalLiabilities, reserves]
// ---------------------------------------------------------------------------

include "../../node_modules/circomlib/circuits/bitify.circom";       // Num2Bits
include "../../node_modules/circomlib/circuits/comparators.circom";  // LessEqThan
include "merkle_sum.circom";

template Solvency(depth, balanceBits) {
    var nLeaves = 1 << depth;

    // ---- public inputs ----
    signal input rootHash;          // committed Merkle-sum root hash
    signal input totalLiabilities;  // committed total carried in the root
    signal input reserves;          // attested reserve figure (public input)

    // ---- private witnesses ----
    signal input balances[nLeaves];
    signal input acctCommit[nLeaves];   // Poseidon(acctId, salt) per leaf

    // 1. NON-NEGATIVITY: force every balance into [0, 2^balanceBits).
    component rng[nLeaves];
    for (var i = 0; i < nLeaves; i++) {
        rng[i] = Num2Bits(balanceBits);
        rng[i].in <== balances[i];
    }

    // 2. SUM CORRECTNESS: recompute the Merkle-sum root from the leaves.
    component leaf[nLeaves];
    signal leafHash[nLeaves];
    for (var i = 0; i < nLeaves; i++) {
        leaf[i] = LeafHash();
        leaf[i].acctCommit <== acctCommit[i];
        leaf[i].balance    <== balances[i];
        leafHash[i] <== leaf[i].out;
    }

    component tree = MerkleSumRoot(depth);
    for (var i = 0; i < nLeaves; i++) {
        tree.leafHash[i] <== leafHash[i];
        tree.leafSum[i]  <== balances[i];
    }

    // Bind the recomputed root to the public commitments.
    tree.rootHash === rootHash;
    tree.rootSum  === totalLiabilities;

    // 3. SOLVENCY: totalLiabilities <= reserves. reserves is range-checked too
    //    so a malicious prover cannot supply a field-wrapped value.
    var cmpBits = balanceBits + depth + 1;

    component resRange = Num2Bits(cmpBits);
    resRange.in <== reserves;

    component le = LessEqThan(cmpBits);
    le.in[0] <== totalLiabilities;
    le.in[1] <== reserves;
    le.out === 1;   // proof is unsatisfiable unless liabilities <= reserves
}
