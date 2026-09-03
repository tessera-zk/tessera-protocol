pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// risk_solvency_tpl.circom  --  UPGRADE 3: CONCENTRATION / RISK LIMITS.
//
// Beats RECTOR-LABS/auspex by proving portfolio HEALTH in zero knowledge, not
// just R >= L. On top of the three base solvency guarantees, this template also
// proves, all in-circuit:
//
//   (4) CONCENTRATION CAP: no single LEAF balance exceeds `maxConcBps`
//       basis-points of total liabilities. Prevents a book whose "solvency" is
//       actually one whale leaf (a run-risk / wrong-way-risk red flag).
//         forall i:  balance_i * 10000 <= maxConcBps * totalLiabilities
//
//       HONEST SCOPE (adversarial-audit FIX 3): this cap is PER-LEAF, not
//       per-customer. `acctCommit[i]` is unconstrained and leaves are not bound
//       to registered customer keys, so a whale can SPLIT its balance across
//       several leaves to evade the cap. A sound per-CUSTOMER cap requires the
//       signed-solvency circuit's keyed leaves (FIX 1) — one keyed leaf per
//       registered customer, keys pinned on-chain — merged into this circuit, or
//       balances aggregated per key before the test. That merge is NOT-YET.
//
//   (5) MIN COLLATERALIZATION: reserves are at least `minCollBps` basis-points
//       of total liabilities (an over-collateralization buffer beyond R>=L).
//         reserves * 10000 >= minCollBps * totalLiabilities
//
// Both bounds are PUBLIC inputs, so the proof publicly commits to the exact risk
// limits it satisfies; a verifier reads them off-chain / on-chain. A book that
// breaches either limit is UNPROVABLE (the constraint is unsatisfiable).
//
// Public signal order (MUST match the Soroban verifier contract):
//   [ rootHash, totalLiabilities, reserves, maxConcBps, minCollBps ]
// ---------------------------------------------------------------------------

include "../../node_modules/circomlib/circuits/bitify.circom";        // Num2Bits
include "../../node_modules/circomlib/circuits/comparators.circom";   // LessEqThan
include "merkle_sum.circom";

template RiskSolvency(depth, balanceBits) {
    var nLeaves = 1 << depth;

    // ---- public inputs ----
    signal input rootHash;
    signal input totalLiabilities;
    signal input reserves;
    signal input maxConcBps;   // e.g. 4000 = no LEAF > 40% of the book (per-leaf; see FIX 3)
    signal input minCollBps;   // e.g. 10500 = reserves >= 105% of liabilities

    // ---- private witnesses ----
    signal input balances[nLeaves];
    signal input acctCommit[nLeaves];

    // ---- basis-point comparison width ----
    // balances/reserves < 2^balanceBits; total < 2^(balanceBits+depth); the bps
    // multipliers are < 2^16. Give the comparators generous headroom.
    var bpsBits = balanceBits + depth + 16 + 1;

    // 1. NON-NEGATIVITY.
    component rng[nLeaves];
    for (var i = 0; i < nLeaves; i++) {
        rng[i] = Num2Bits(balanceBits);
        rng[i].in <== balances[i];
    }

    // 2. LEAF COMMITMENTS + SUM CORRECTNESS.
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
    tree.rootHash === rootHash;
    tree.rootSum  === totalLiabilities;

    // 3. SOLVENCY: totalLiabilities <= reserves (reserves range-checked).
    var cmpBits = balanceBits + depth + 1;
    component resRange = Num2Bits(cmpBits);
    resRange.in <== reserves;
    component le = LessEqThan(cmpBits);
    le.in[0] <== totalLiabilities;
    le.in[1] <== reserves;
    le.out === 1;

    // range-check the bps public inputs so they cannot be field-wrapped.
    component concRange = Num2Bits(16);
    concRange.in <== maxConcBps;
    component collRange = Num2Bits(16);
    collRange.in <== minCollBps;

    // 4. CONCENTRATION CAP: balance_i * 10000 <= maxConcBps * totalLiabilities.
    signal concRhs;
    concRhs <== maxConcBps * totalLiabilities;
    component conc[nLeaves];
    for (var i = 0; i < nLeaves; i++) {
        conc[i] = LessEqThan(bpsBits);
        conc[i].in[0] <== balances[i] * 10000;
        conc[i].in[1] <== concRhs;
        conc[i].out === 1;   // unsatisfiable if any account exceeds the cap
    }

    // 5. MIN COLLATERALIZATION: reserves * 10000 >= minCollBps * totalLiabilities.
    component coll = LessEqThan(bpsBits);
    coll.in[0] <== minCollBps * totalLiabilities;
    coll.in[1] <== reserves * 10000;
    coll.out === 1;          // unsatisfiable if reserves fall below the min ratio
}
