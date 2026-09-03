pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// signed_solvency_tpl.circom  --  UPGRADE 1 (STRONGEST FORM):
//   IN-CIRCUIT EdDSA proof-of-liabilities NON-OMISSION.
//
// This is the cryptographic upgrade over the on-chain-ed25519 scheme in
// UPGRADES-STATUS.md. Instead of the contract re-checking each signed leaf and
// relying on user vigilance (bulletin-board assumption), the SNARK ITSELF proves
// that:
//
//   (A) every leaf in the Merkle-sum tree carries a valid Baby-JubJub EdDSA
//       signature by its owner over (epoch, balance, nonce)  -> no UNSIGNED /
//       fabricated leaf can appear in the tree, and
//   (B) each leaf's signer public key (Ax_i, Ay_i) is a PUBLIC input, so the
//       verifier (the Soroban contract) can check the exact ordered key set the
//       proof was built over against the on-chain, CUSTOMER-self-registered key
//       list -> the tree is built from EXACTLY the registered set of customers,
//       so no registered account can be OMITTED and no unregistered account can
//       be smuggled in.
//
// NON-OMISSION CIRCULARITY FIX (adversarial-audit FIX 1): the earlier design put
// a single `pubkeyHash = Poseidon(all keys)` as the public input and let the
// ISSUER publish that hash on-chain under its own authorization. An issuer could
// therefore publish Poseidon(keys of the subset it wanted) and prove solvency of
// that subset, omitting a customer. Here the individual keys are public and the
// contract pins them, position-by-position, against a key list that each customer
// appended UNDER THEIR OWN require_auth. The issuer never authors the set, so it
// cannot drop a registered customer without failing the on-chain pin.
//
// Public signal order (MUST match the Soroban verifier contract):
//   [ rootHash, totalLiabilities, reserves, epoch, Ax[0..n-1], Ay[0..n-1] ]
//
// Plus the existing solvency guarantees (non-negativity, sum-correctness,
// totalLiabilities <= reserves) are unchanged.
//
// Field: BN254 scalar field (= Baby-JubJub base field). Hash: circomlib Poseidon.
// Signature: circomlib EdDSAPoseidonVerifier (Baby-JubJub, Poseidon-based).
// ---------------------------------------------------------------------------

include "../../node_modules/circomlib/circuits/bitify.circom";        // Num2Bits
include "../../node_modules/circomlib/circuits/comparators.circom";   // LessEqThan
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";  // EdDSAPoseidonVerifier
include "merkle_sum.circom";

template SignedSolvency(depth, balanceBits) {
    var nLeaves = 1 << depth;

    // ---- public inputs ----
    signal input rootHash;          // committed Merkle-sum root hash
    signal input totalLiabilities;  // committed total carried in the root
    signal input reserves;          // attested reserve figure
    signal input epoch;             // attestation epoch bound into each signature
    signal input Ax[nLeaves];       // Baby-JubJub public key x of each leaf's
    signal input Ay[nLeaves];       // signer (PUBLIC: pinned on-chain to the
                                    //   customer-self-registered ordered key list)

    // ---- private witnesses (one entry per leaf/customer) ----
    signal input balances[nLeaves];
    signal input nonces[nLeaves];   // per-user per-epoch nonce (also binds acctCommit)
    signal input S[nLeaves];        // EdDSA signature scalar
    signal input R8x[nLeaves];      // EdDSA signature R8.x
    signal input R8y[nLeaves];      // EdDSA signature R8.y

    // 1. IN-CIRCUIT SIGNATURE VERIFICATION.
    //    Message signed by each user: M_i = Poseidon(epoch, balance_i, nonce_i).
    //    EdDSAPoseidonVerifier with enabled=1 makes the whole witness
    //    UNSATISFIABLE if any signature is invalid -> the prover cannot place an
    //    unsigned or forged leaf in the tree.
    component msg[nLeaves];
    component sig[nLeaves];
    for (var i = 0; i < nLeaves; i++) {
        msg[i] = Poseidon(3);
        msg[i].inputs[0] <== epoch;
        msg[i].inputs[1] <== balances[i];
        msg[i].inputs[2] <== nonces[i];

        sig[i] = EdDSAPoseidonVerifier();
        sig[i].enabled <== 1;
        sig[i].Ax  <== Ax[i];
        sig[i].Ay  <== Ay[i];
        sig[i].S   <== S[i];
        sig[i].R8x <== R8x[i];
        sig[i].R8y <== R8y[i];
        sig[i].M   <== msg[i].out;
    }

    // 2. NON-NEGATIVITY + LEAF COMMITMENT.
    //    acctCommit binds the SIGNER's public key into the very leaf, so a leaf's
    //    identity cannot be separated from the key that signed it.
    //      acctCommit_i = Poseidon(Ax_i, Ay_i, nonce_i)
    //      leaf.hash    = Poseidon(acctCommit_i, balance_i)
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

    // 3. SUM CORRECTNESS: recompute the Merkle-sum root from the signed leaves.
    component tree = MerkleSumRoot(depth);
    for (var i = 0; i < nLeaves; i++) {
        tree.leafHash[i] <== leafHash[i];
        tree.leafSum[i]  <== balances[i];
    }
    tree.rootHash === rootHash;
    tree.rootSum  === totalLiabilities;

    // 4. SOLVENCY: totalLiabilities <= reserves, reserves range-checked.
    var cmpBits = balanceBits + depth + 1;
    component resRange = Num2Bits(cmpBits);
    resRange.in <== reserves;
    component le = LessEqThan(cmpBits);
    le.in[0] <== totalLiabilities;
    le.in[1] <== reserves;
    le.out === 1;

    // 5. NON-OMISSION: the signer public keys Ax[i], Ay[i] are PUBLIC inputs.
    //    The Soroban verifier pins each (Ax[i], Ay[i]) against the on-chain,
    //    customer-self-registered ordered key list. Because acctCommit_i =
    //    Poseidon(Ax_i, Ay_i, nonce_i) is bound into leaf i and each leaf is
    //    signed by (Ax_i, Ay_i), a proof cannot drop a registered customer
    //    (its key must appear at its position), substitute a different key, or
    //    add an unregistered one: the on-chain pin rejects any such tree. No
    //    single issuer-authored commitment is trusted here.
}
