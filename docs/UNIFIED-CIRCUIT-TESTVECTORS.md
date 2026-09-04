# Unified circuit — test vectors (expected outcomes)

Honest track only; no proofs generated in this PR (no zkey). Each vector
states whether a witness SHOULD exist once the circuit is set up.

## HU-1 honest book (should be provable after setup)

- balances [8000, 7000, 6000, 7000], total 28000, reserves 30000
- epoch 0, real per-leaf EdDSA signatures over Poseidon(epoch, balance, nonce)
- maxConcBps 4000 (max leaf 8000/28000 = 28.6% < 40%), minCollBps 10500
  (30000/28000 = 107.1% >= 105%)
- Expect: witness satisfiable, root recomputes, all comparators pass.

## HU-2 negative leaf (must be unprovable)

- balances [8000, -100, 6000, 7000] (field-wrapped negative)
- Expect: `Num2Bits(64)` fails at witness generation. No proof exists.
- Maps to frontend error `NEGATIVE_COMMITMENT`.

## HU-3 underfunded (must be unprovable)

- total 28000, reserves 20000
- Expect: `LessEqThan` solvency fails. No proof exists.
- Maps to frontend error `UNDERFUNDED`.

## HU-4 whale leaf (must be unprovable)

- balances [20000, 3000, 3000, 2000], total 28000, maxConcBps 4000
- 20000/28000 = 71.4% > 40%
- Expect: per-leaf concentration comparator fails. No proof exists.
- Caveat (FIX 3): splitting 20000 across two leaves evades this cap;
  per-member tracking is NOT-YET (#11).

## HU-5 forged signature (must be unprovable)

- Any leaf with invalid (S, R8x, R8y) for its (Ax, Ay, M).
- Expect: `EdDSAPoseidonVerifier` fails. No proof exists.

## HU-6 omitted member (must be rejected on-chain, not in-circuit)

- Valid proof over substituted key set (filler key at omitted slot).
- Expect: Groth16 verifies mathematically, but contract pin against
  `register_customer_key` list fails with Error #10 (FIX 1 pattern).
