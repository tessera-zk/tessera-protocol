# Keyed-risk R1 — EdDSA merge + per-key concentration (issue #66, 2026-09-10)

**Status**: R1 CIRCUIT DONE (compile + witness vectors). R2–R6 remain open;
the live `risk_solvency` claim stays honestly per-LEAF until R1–R5 land.

## What R1 built

`circuits/keyed_risk_r1.circom` (depth 2, 64-bit) over new template
`circuits/lib/keyed_risk_r1_tpl.circom`. The #11 prototype bound keys without
verifying them; R1 adds both missing halves:

1. **Authentication**: `EdDSAPoseidonVerifier` per leaf over
   `M = Poseidon(epoch, balance, nonce)` (FIX 1 pattern, as in UnifiedSolvency).
2. **Per-key aggregation**: `keySum[i] = Σ_j eq(key_j, key_i) · balances[j]`
   via `IsEqual` pairs, capped per key:
   `keySum[i] · 10000 <= maxConcBps · total`.

Public signals (unified-compatible order for the future R3 entrypoint):
`[rootHash, totalLiabilities, reserves, epoch, Ax×4, Ay×4, maxConcBps, minCollBps]` (14).

## Measured (compile 2026-09-10, circom 2.2.3)

| Item | Value |
|------|-------|
| wires | 42,454 |
| non-linear constraints | 34,441 |
| linear constraints | 8,031 |
| **total constraints** | **42,472** (≈ unified's 42,344 — same EdDSA-dominated profile) |
| public / private inputs | 14 / 20 |

## Vectors (`bash scripts/run_keyed_risk_r1_vectors.sh` → pass=5 fail=0)

| Vector | Book | Cap | Outcome | Kill point |
|---|---|---|---|---|
| V1 distinct keys A,B,C,D `[8000,7000,6000,7000]` | 28000/30000 | 4000 | PASS (witness OK) | — |
| V2 shared key K,K,C,D `[8000,8000,6000,6000]` | 28000/30000 | 4000 | FAIL (as expected) | `conc.out===1` L146 (keySum 16000 > 11200; per-leaf would pass at 8000) |
| V3 same book as V2 | 28000/30000 | 6000 | PASS (as expected) | — (16000 ≤ 16800: the SUM is enforced, not a same-key ban) |
| V4 V1 + S[2] flipped | — | 4000 | UNPROVABLE (as expected) | `EdDSAPoseidonVerifier` (sig verify L70) |
| V5 V1 book, reserves 28000 | 28000/28000 | 4000 | FAIL (as expected) | collateral floor (28000 < 29400) |

V2/V3 share the root `10510638937270113050…` (same book — only the public cap
moves), which is precisely the evasion dial: one book, fail at 40%, pass at 60%.

## Honest scope

- Witness-level only: no ptau/zkey/vkey yet (setup is R6), no contract
  entrypoint (R3), no audit. Sybil stance unchanged (policy doc governs R2).
- Per-key here = per BabyJubJub key; one human with two keys still splits
  (disclosed, same as the audit pack).
