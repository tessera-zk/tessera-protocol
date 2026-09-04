# Keyed-risk audit notes (issue #11)

What an auditor must check before this prototype becomes an enforced claim:

1. Key binding: `acctCommit_i = Poseidon(Ax_i, Ay_i, nonce_i)` bound into
   `leaf.hash`; no unconstrained `acctCommit` input remains (the FIX 3 hole).
2. Pin completeness: future `submit_keyed_risk_attestation` pins ALL
   `(Ax_i, Ay_i)` against `register_customer_key` order (Error #10 on mismatch).
3. One-position-per-member: enforced by pin length == registered count; Sybil
   (duplicate human, two keys) needs registration policy, not just circuit.
4. Range checks: `reserves`, `maxConcBps`, `minCollBps` range-checked so no
   field-wrapped bypass.
5. Epoch binding: if signatures are added later, `epoch` must be bound into
   the signed message (FIX 4 replay rule).
6. No overclaim: until deployed + testnet-demonstrated, docs keep saying
   per-LEAF for the live circuit and per-member only for this prototype.
