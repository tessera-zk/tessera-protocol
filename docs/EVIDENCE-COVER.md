# Evidence pack cover (issue #44)

Audience: auditors, regulators, diligence teams evaluating Tessera claims.
Promise: **every claim in this pack resolves to a transaction hash, a passing
test, a log file, or a NOT-YET label.** Anything else is a bug in the pack —
file it as one (see `.github/ISSUE_TEMPLATE/bug_report.yml`).

## Contents

1. `docs/EVIDENCE-INDEX.md` — claim-to-evidence table (the core).
2. `docs/EVIDENCE-VERIFY-COMMANDS.md` — copy-paste re-verification.
3. `docs/RED-TEAM-FAQ.md` — adversarial questions, honest answers.
4. `docs/LIMITATIONS-STATEMENT.md` — plain-language limits.
5. `scripts/evidence_selfcheck.js` — pack hygiene gate (runnable).

## Freshness

Pack cut: 2026-09-07, repo `tessera-zk/tessera-protocol`, `main`.
Testnet evidence is Protocol 27. Re-run the verify commands before relying
on any claim — chain state and code both move.
