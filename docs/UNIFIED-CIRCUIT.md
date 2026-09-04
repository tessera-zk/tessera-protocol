# Unified circuit — health + risk + non-omission (NOT-YET #1)

Status: **design + skeleton only. NOT deployed, NOT verified on-chain.**
Closes #5 when merged (spec track); the deployable unified circuit remains NOT-YET.

## Why

PRD NOT-YET #1: today we ship four primitives as separate circuits /
attestations (`solvency`, `signed_solvency`, `risk_solvency`, `inclusion`).
The project-level combined edge (health + risk + inclusion together) already
exceeds any single competitor, but a single proof asserting every property
simultaneously is the honest build target.

## What the unified circuit must prove (all in-circuit)

1. Health: per-leaf non-negativity (`Num2Bits(64)`), Merkle-sum root + total,
   `totalCommitments <= treasury` (from `solvency_tpl.circom`).
2. Non-omission: per-leaf Baby-JubJub `EdDSAPoseidonVerifier` over
   `M = Poseidon(epoch, balance, nonce)`, `acctCommit = Poseidon(Ax, Ay, nonce)`
   bound into the leaf, signer keys `(Ax, Ay)` PUBLIC and pinned on-chain
   (from `signed_solvency_tpl.circom`, FIX 1).
3. Risk: per-LEAF concentration cap + min-collateralization floor, both PUBLIC
   (from `risk_solvency_tpl.circom`, FIX 3 honest scope).
4. Freshness binding: `epoch` PUBLIC, strictly increasing on-chain (FIX 4).

## Public-signal order (proposed, must match future contract)

```
[rootHash, totalLiabilities, reserves, epoch,
 Ax[0..n-1], Ay[0..n-1],
 maxConcBps, minCollBps]
```

Count for depth d: `4 + 2*2^d + 2`. Depth-2 demo: 4 + 8 + 2 = 14 signals.

## Constraint estimate (depth 2, 4 leaves)

- Base solvency (depth 2): ~5k (scales from depth-4 20,511).
- 4x EdDSA verifiers: ~4 × ~7k ≈ 28k (signed_solvency depth-2 is ~34.3k total).
- Risk comparators (4 leaves + collateral): ~2k.
- Estimate: **~35–40k non-linear constraints**, ptau 2^16 (same as
  `signed_solvency`). Depth-4 unified would be ~16 leaves: ~120–150k, ptau 2^18.

## Files in this PR

- `circuits/lib/unified_solvency_tpl.circom` — template skeleton (compilable).
- `circuits/unified_solvency.circom` — depth-2 demo instantiation.
- `scripts/gen_unified_input.js` — deterministic demo input generator.
- `scripts/build_unified.sh` — compile + setup harness (does not run ptau).
- `docs/UNIFIED-CIRCUIT-TESTVECTORS.md` — expected honest/reject cases.

## Explicit non-goals (still NOT-YET after this PR)

- No verification key, no proving key, no on-chain verifier entrypoint.
- No testnet transaction; no `submit_unified_attestation` contract method.
- No audit; per-member concentration remains per-leaf until FIX 3 merge lands.
