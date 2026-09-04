# CI runbook (issue #13)

Workflows (all in `.github/workflows/`):

| workflow | triggers | does |
|---|---|---|
| `circuits.yml` | circuits/scripts changes | compile solvency + unified skeleton (no ptau), run input generators + depth estimator |
| `contract.yml` | contracts changes | `cargo test -p tessera-ledger` (25 tests) + assert oracle-spike stays off-build |
| `frontend.yml` | frontend changes | `tsc --noEmit` + secret-hygiene gate |
| `docs.yml` | docs/md changes | cross-link check + forbid `NEXT_PUBLIC_*SECRET` in docs |

Depth-10 rule: CI never downloads the 2.3GB 2^21 ptau. Full depth-10 runs
need `TESSERA_RUN_DEPTH10=1` + a mirrored ptau on a provisioned host
(see `docs/DEPTH10-PLAN.md`).

First run after merge: watch Actions on `main`, confirm all four green, then
add branch protection (require CI green before merge).
