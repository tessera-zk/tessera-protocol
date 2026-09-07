# Frontend hardening notes (issue #14)

What this PR adds beyond the shipped issuer/inclusion/board pages:

- `frontend/lib/errors.ts`: typed `classifyProverError` + `errorAdvice`
  (11 codes covering every honest-reject path: negative, underfunded, whale,
  thin collateral, forged, omitted, stale, unbacked, missing auth, bad leg).
- `scripts/check_secret_hygiene.js`: CI-runnable gate (also in `frontend.yml`).
- `docs/PROVER-ERRORS.md` + `docs/SECRET-HYGIENE-CHECKLIST.md`: operator docs.

Integration LANDED in #41: `lib/proverErrors.ts` (`toErrorOutcome`) bridges
`WitnessError` kinds + `classifyProverError` into `{code, detail}`, rendered
by `components/ErrorBanner.tsx` on the issuer + inclusion pages
(see `docs/ERROR-SURFACING.md`). No prover logic changed, so no proving
regression risk.
