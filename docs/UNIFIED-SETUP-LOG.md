# Unified phase-2 setup log (issue #36) — REAL run, 2026-09-07

Toolchain: circom 2.2.3, snarkjs 0.7.6, Hermez ptau 2^16
(`powersOfTau28_hez_final_16.ptau`, sha256 `1c401abb57c9ce53…`, 75,580,568 B).
Command: `bash scripts/unified_setup.sh` (wall time 3m22s).

## Measured circuit

- Wires: 42,326. Constraints: **42,344** (spec estimate was 35–40k — actual
  is 6–21% higher; estimate corrected here, not hidden).
- Private inputs: 24. Public inputs: 14. Curve: bn128.

## Artifacts (sha256)

- r1cs: `726a69b4895d55bcbc837c3e3f14060a2aed3981e13ce4f6e2203546c7bd2b0e`
- zkey (single-contributor `tessera-local-1`, DISCLOSED non-ceremony):
  `0db34e2b8001059c11e766d74bdab3691b4fbe2140908358e78b69ae57cdb158`
  — stays in `build/unified/` (gitignored), NOT committed.
- vkey: `4230df2c38c3577ed79a2b9f94d20168a226f11377b86eca8e5f453d7dd832a5`
  — committed as `circuit-keys/vk_unified_solvency.json` (5,305 B).
- `snarkjs zkey verify r1cs ptau zkey`: **OK** (`ZKey Ok!`).

## What this does NOT mean

No contract entrypoint consumes this vkey yet (follow-up: #56); production
still needs the ceremony in `docs/TRUSTED-SETUP-CEREMONY.md`.

## Positive control (issue #55, 2026-09-10)

First real unified proof generated (needs real member signatures — done):
`bash scripts/prove_unified_positive.sh` → pass=2 fail=0, snarkJS OK, root
`1008867166562…37604901`, 14 signals in pinned order. Full record:
`docs/UNIFIED-POSITIVE-CONTROL.md`.
