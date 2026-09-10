# Unified Positive Control — issue #55

**Date**: 2026-09-10 · **Status**: PASS (`UNIFIED POSITIVE RESULT: pass=2 fail=0`)
**Command**: `bash scripts/prove_unified_positive.sh`
**Closes the top remainder of #36/#46** (real 2^16 phase-2 done, negative control
measured, but every unified input was placeholder zeros until now).

## What was proven

A depth-2 unified book with **4 real Baby-JubJub EdDSA signatures verified
in-circuit**, keyed leaves, a recomputed Merkle-sum root, and holding risk bounds —
witness via `build/unified/unified_solvency_js/unified_solvency.wasm`, Groth16 prove
with `build/unified/unified_final.zkey` (real phase-2, #36), verify against
`circuit-keys/vk_unified_solvency.json` → **snarkJS OK**.

## Measured values (deterministic — rerun the generator to reproduce byte-identical)

| Item | Value |
|------|-------|
| rootHash | `10088671665620804722384723141474773842541738737549248387290084559108637604901` |
| totalLiabilities | `28000` (8000+7000+6000+7000) |
| reserves | `30000` |
| epoch | `0` |
| maxConcBps / minCollBps | `4000` / `10500` |
| public signals | 14, order `[root,total,reserves,epoch,Ax×4,Ay×4,maxConc,minColl]` — asserted in-script |
| member keys | deterministic `sha256("tessera-unified-positive-{0..3}")` → BabyJub pubkeys (see `contracts/artifacts/unified-positive.json`) |
| message signed | `M = Poseidon(epoch, balance, nonce)`, nonces 11/22/33/44 |

## Negative control (same run)

S bit flipped at slot 2 → witness calculation aborts in
`ForceEqualIfEnabled` ← `EdDSAPoseidonVerifier` ← `UnifiedSolvency` line 66 —
the exact same kill point as the #36 negative control. Forgery is unprovable,
not merely rejected.

## Honest scope

- Single-contributor phase-2 trust assumption unchanged (production needs the
  MPC ceremony, #9 plan).
- Depth-2 demo instance only (4 leaves); depth-8+ unified still needs the
  provisioned ptau/RAM path (#39 runbook).
- Contract entrypoint is NOT part of this issue — public signals are pinned in
  the order above for #56 (`submit_unified_attestation`).
- Private keys and raw signatures are never committed; only the input generator
  (deterministic) and the public artifact are in the repo. `build/` stays
  gitignored — regenerate locally.
