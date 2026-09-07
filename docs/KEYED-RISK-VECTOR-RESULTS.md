# Keyed-risk vector results (issue #37) — REAL runs, 2026-09-07

Runner: `bash scripts/run_keyed_risk_vectors.sh` (vectors generated at
runtime, asserted on exit codes). Verbatim output:

```
KR 1 even-book: as expected (exit 0)
KR 2 split-holder: as expected (exit 0)
KR 3 whale-position: as expected (exit 2)
KR 4 thin-reserves: as expected (exit 2)
vectors: 4 as-expected, 0 unexpected
```

Reading:

- KR-1 (even book, 105% collateral): PASS — healthy books stay provable.
- KR-2 (one holder's 8000 split as 4000+4000): PASS per-position. This is the
  Sybil gap made visible, not a missed bug — policy answer in
  `docs/KEYED-RISK-SYBIL-POLICY.md` (stance D now, B for regulated issuers).
- KR-3 (12000/16000 = 75% in one position, cap 40%): FAIL at `conc[0]` —
  concentration enforced.
- KR-4 (reserves 100% < 105% floor): FAIL at collateral comparator — floor
  enforced.

These are off-circuit checks of the same inequalities the template proves;
they validate the vectors, not the circuit. Circuit soundness argument is in
`docs/KEYED-RISK-CONSTRAINT-REVIEW.md`.
