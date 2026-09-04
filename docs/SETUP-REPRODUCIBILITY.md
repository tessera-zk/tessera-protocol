# Setup reproducibility record (issue #9)

How to reproduce — or audit — every proving key in this repo.

## Per-circuit record (fill when keys change)

| circuit | r1cs sha256 | ptau file + sha256 | zkey sha256 | contributors | date |
|---|---|---|---|---|---|
| solvency (depth 4) | _fill_ | `powersOfTau28_hez_final_15.ptau` _fill_ | _fill_ | single (disclosed) | _fill_ |
| signed_solvency (depth 2) | _fill_ | `powersOfTau28_hez_final_16.ptau` _fill_ | _fill_ | single (disclosed) | _fill_ |
| risk_solvency (depth 4) | _fill_ | `powersOfTau28_hez_final_15.ptau` _fill_ | _fill_ | single (disclosed) | _fill_ |
| inclusion (depth 4) | _fill_ | `powersOfTau28_hez_final_15.ptau` _fill_ | _fill_ | single (disclosed) | _fill_ |

Commands:

```bash
bash scripts/verify_ptau.sh ptau/powersOfTau28_hez_final_15.ptau
bash scripts/verify_zkey.sh build/solvency.r1cs ptau/powersOfTau28_hez_final_15.ptau circuit-keys/solvency_final.zkey
```

## Rules

- Never commit a `.zkey` without its hashes recorded here.
- Phase-1 stays Hermez public; phase-2 single-contributor until the ceremony
  in `docs/TRUSTED-SETUP-CEREMONY.md` runs.
- The single-contributor caveat applies to all soundness claims until then.
