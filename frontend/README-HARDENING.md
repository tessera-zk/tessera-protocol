# Frontend hardening notes (issue #14)

What this PR adds beyond the shipped issuer/inclusion/board pages:

- `frontend/lib/errors.ts`: typed `classifyProverError` + `errorAdvice`
  (11 codes covering every honest-reject path: negative, underfunded, whale,
  thin collateral, forged, omitted, stale, unbacked, missing auth, bad leg).
- `scripts/check_secret_hygiene.js`: CI-runnable gate (also in `frontend.yml`).
- `docs/PROVER-ERRORS.md` + `docs/SECRET-HYGIENE-CHECKLIST.md`: operator docs.

Integration left to the page layer (small, reviewable follow-up): wrap
`lib/prover.ts` throws in issuer/inclusion pages with
`classifyProverError(err.message)` and render `errorAdvice(code)`.
No prover logic changed here, so no proving regression risk.
