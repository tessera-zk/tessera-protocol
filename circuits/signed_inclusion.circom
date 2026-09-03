pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// signed_inclusion.circom  --  depth-2 inclusion instance matching the
// signed_solvency depth-2 demo tree. A user proves their leaf was counted in the
// IN-CIRCUIT-attested Merkle-sum root. Same Inclusion template as inclusion.circom,
// just instantiated at the signed demo's depth. Public: [rootHash, leafCommitment].
// ---------------------------------------------------------------------------

include "lib/merkle_sum.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// Reuse the Inclusion template by including the base file's template definition.
// (inclusion.circom defines `template Inclusion` then a depth-4 main; we cannot
// include it directly because it also declares a main, so the template body is
// duplicated minimally here at depth 2.)
template InclusionD2(depth, balanceBits) {
    signal input rootHash;
    signal input leafCommitment;
    signal input balance;
    signal input acctCommit;
    signal input siblingHash[depth];
    signal input siblingSum[depth];
    signal input pathIndex[depth];

    component rng = Num2Bits(balanceBits);
    rng.in <== balance;

    component leaf = LeafHash();
    leaf.acctCommit <== acctCommit;
    leaf.balance    <== balance;
    leaf.out === leafCommitment;

    component level[depth];
    signal curHash[depth + 1];
    signal curSum[depth + 1];
    curHash[0] <== leaf.out;
    curSum[0]  <== balance;
    for (var i = 0; i < depth; i++) {
        level[i] = MerkleSumInclusionLevel();
        level[i].curHash   <== curHash[i];
        level[i].curSum    <== curSum[i];
        level[i].sibHash   <== siblingHash[i];
        level[i].sibSum    <== siblingSum[i];
        level[i].pathIndex <== pathIndex[i];
        curHash[i + 1] <== level[i].outHash;
        curSum[i + 1]  <== level[i].outSum;
    }
    curHash[depth] === rootHash;
}

component main { public [rootHash, leafCommitment] } = InclusionD2(2, 64);
