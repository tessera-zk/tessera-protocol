pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// Merkle-sum tree templates for the ZK Proof-of-Reserves circuits.
//
// Design (per Vitalik's proof-of-solvency and Summa's circuits-circom, but an
// independent MIT-licensed implementation using circomlib's BN254 Poseidon):
//
//   leaf node   : hash = Poseidon(acctCommit, balance),  sum = balance
//   internal    : hash = Poseidon(Lh, Ls, Rh, Rs),       sum = Ls + Rs
//   root        : (rootHash, totalLiabilities)
//
// Binding the running SUM into the same commitment as the hash structure is
// what defeats the naive-Merkle negative-balance attack: an attacker cannot
// shrink the reported total with a hidden negative leaf because every leaf is
// separately range-checked AND its sum is carried up into the root.
// ---------------------------------------------------------------------------

include "../../node_modules/circomlib/circuits/poseidon.circom";

// One layer of the Merkle-sum tree: turns 2*nParents child (hash,sum) pairs
// into nParents parent (hash,sum) pairs.
//   parent.hash = Poseidon(Lh, Ls, Rh, Rs)
//   parent.sum  = Ls + Rs
template MerkleSumLayer(nParents) {
    signal input  inHash[nParents * 2];
    signal input  inSum[nParents * 2];
    signal output outHash[nParents];
    signal output outSum[nParents];

    component h[nParents];
    for (var i = 0; i < nParents; i++) {
        h[i] = Poseidon(4);
        h[i].inputs[0] <== inHash[2*i];       // left  hash
        h[i].inputs[1] <== inSum[2*i];        // left  sum
        h[i].inputs[2] <== inHash[2*i + 1];   // right hash
        h[i].inputs[3] <== inSum[2*i + 1];    // right sum
        outHash[i] <== h[i].out;
        // sum carried up; because each leaf sum is range-checked in the top
        // level circuit and balanceBits + depth stays far below the field
        // width, this addition cannot overflow the BN254 scalar field.
        outSum[i]  <== inSum[2*i] + inSum[2*i + 1];
    }
}

// Full Merkle-sum tree: folds 2^depth leaf (hash,sum) pairs into a single root.
template MerkleSumRoot(depth) {
    var nLeaves = 1 << depth;
    signal input  leafHash[nLeaves];
    signal input  leafSum[nLeaves];
    signal output rootHash;
    signal output rootSum;

    component layers[depth];
    // Build from the bottom (level = depth-1, closest to leaves) up to the root
    // (level = 0). Level L has 2^L parent nodes.
    for (var level = depth - 1; level >= 0; level--) {
        var nParents = 1 << level;
        layers[level] = MerkleSumLayer(nParents);
        for (var i = 0; i < nParents * 2; i++) {
            if (level == depth - 1) {
                layers[level].inHash[i] <== leafHash[i];
                layers[level].inSum[i]  <== leafSum[i];
            } else {
                layers[level].inHash[i] <== layers[level + 1].outHash[i];
                layers[level].inSum[i]  <== layers[level + 1].outSum[i];
            }
        }
    }

    rootHash <== layers[0].outHash[0];
    rootSum  <== layers[0].outSum[0];
}

// Leaf commitment: leaf.hash = Poseidon(acctCommit, balance).
// acctCommit is itself Poseidon(acctId, salt) computed off-circuit so account
// identity is never revealed on-chain.
template LeafHash() {
    signal input  acctCommit;
    signal input  balance;
    signal output out;

    component h = Poseidon(2);
    h.inputs[0] <== acctCommit;
    h.inputs[1] <== balance;
    out <== h.out;
}

// One level of a Merkle-sum INCLUSION path. Given the current subtree
// (curHash, curSum), a sibling (sibHash, sibSum) and a boolean pathIndex
// (0 => current node is the LEFT child, 1 => current node is the RIGHT child),
// it outputs the parent (hash, sum).
template MerkleSumInclusionLevel() {
    signal input curHash;
    signal input curSum;
    signal input sibHash;
    signal input sibSum;
    signal input pathIndex;   // 0 or 1

    signal output outHash;
    signal output outSum;

    // pathIndex must be boolean.
    pathIndex * (pathIndex - 1) === 0;

    // Order children by pathIndex using a linear mux:
    //   sel = 0 -> left = cur,  right = sib
    //   sel = 1 -> left = sib,  right = cur
    signal leftHash;
    signal leftSum;
    signal rightHash;
    signal rightSum;

    leftHash  <== curHash + pathIndex * (sibHash - curHash);
    leftSum   <== curSum  + pathIndex * (sibSum  - curSum);
    rightHash <== sibHash + pathIndex * (curHash - sibHash);
    rightSum  <== sibSum  + pathIndex * (curSum  - sibSum);

    component h = Poseidon(4);
    h.inputs[0] <== leftHash;
    h.inputs[1] <== leftSum;
    h.inputs[2] <== rightHash;
    h.inputs[3] <== rightSum;

    outHash <== h.out;
    outSum  <== curSum + sibSum;   // order-independent
}
