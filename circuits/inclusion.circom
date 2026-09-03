pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// inclusion.circom  --  A single user proves THEIR balance was counted in the
// attested Merkle-sum root, in zero knowledge (balance stays private).
//
//   (1) leaf non-negative   balance in [0, 2^balanceBits)
//   (2) leaf commitment      leafCommitment == Poseidon(acctCommit, balance)
//   (3) inclusion           folding the private co-path up reproduces the
//                           public rootHash
//
// Public signal order (MUST match the Soroban verifier contract):
//   [ rootHash, leafCommitment ]
//
// Field: BN254 scalar field (circom default). Hash: circomlib Poseidon.
// ---------------------------------------------------------------------------

include "../node_modules/circomlib/circuits/bitify.circom";   // Num2Bits
include "lib/merkle_sum.circom";

template Inclusion(depth, balanceBits) {
    // ---- public inputs ----
    signal input rootHash;         // the on-chain attested Merkle-sum root
    signal input leafCommitment;   // this user's leaf hash (so they recognise it)

    // ---- private witnesses ----
    signal input balance;
    signal input acctCommit;
    signal input siblingHash[depth];   // co-path node hashes, leaf->root
    signal input siblingSum[depth];    // co-path node sums,  leaf->root
    signal input pathIndex[depth];     // 0/1 selector per level (0=cur is left)

    // 1. leaf non-negativity.
    component rng = Num2Bits(balanceBits);
    rng.in <== balance;

    // 2. leaf commitment: leaf.hash = Poseidon(acctCommit, balance).
    component leaf = LeafHash();
    leaf.acctCommit <== acctCommit;
    leaf.balance    <== balance;
    leaf.out === leafCommitment;

    // 3. fold the co-path up to the root.
    component level[depth];
    signal curHash[depth + 1];
    signal curSum[depth + 1];
    curHash[0] <== leaf.out;
    curSum[0]  <== balance;   // leaf.sum = balance

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

    // The recomputed root must equal the public attested root.
    curHash[depth] === rootHash;
}

// Demo instantiation: depth 4 (matches solvency), 64-bit balances.
component main { public [rootHash, leafCommitment] } = Inclusion(4, 64);
