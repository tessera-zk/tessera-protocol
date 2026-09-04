# Contributing to Tessera

Testnet-only research software. Every claim must resolve to a tx hash, a
passing test, or a NOT-YET tag.

## Workflow

1. Open an issue from the PRD/ADVANCED-STATUS NOT-YET list (or a bug with a
   failing test/command).
2. Branch: `feat/<slug>-<issue>` or `chore/<slug>-<issue>`.
3. Keep commits atomic (one file or one logical unit each) with prefixes:
   `feat(circuits)`, `feat(contracts)`, `feat(frontend)`, `feat(scripts)`,
   `docs(...)`, `chore(...)`.
4. Never commit `.env.local`, `build/`, `ptau/`, `target/`, `.next/`.
5. Docs that add a claim must cite evidence (tx hash on
   `stellar.expert/explorer/testnet`, `cargo test` output, or log file) or tag
   NOT-YET with the blocker.
6. PR body must say which issue it closes and what remains NOT-YET.

## Checks (also run in CI)

- `cd contracts && cargo test -p tessera-ledger` (25 tests).
- Frontend: `npx tsc --noEmit` + `node scripts/check_secret_hygiene.js`.
- Circuits touched: compile the changed template (no ptau in CI).
- Docs touched: docs link check must pass.

## Honesty rules

- Do not relax Error #13 (1:1) without the Reflector design (issue #10).
- Do not claim per-member concentration (live claim is per-LEAF, FIX 3).
- Keep the single-contributor setup caveat on every soundness claim.
