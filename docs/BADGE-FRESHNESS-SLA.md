# Badge freshness SLA (issue #74 — remainder of #6/#16)

The badge/JSON endpoints shipped as frontend polish with a documented hole:
**a stale `healthy` badge looks identical to a fresh one.** This file closes
the policy half; `scripts/check_badge_freshness.js` closes the mechanical half.
Production deployment of the badge (issuer hosting + monitoring) is still
NOT-YET — no fake deployment is claimed here.

## Policy

| State | Condition (either clock) | Badge meaning |
|---|---|---|
| FRESH | attestation age ≤ SLA | `healthy <ratio>` as today |
| STALE | age > SLA | MUST render stale styling (gray) + `stale` status; MUST NOT show green |
| NO_ATTESTATION | no stored attestation | `pending` amber (existing behavior) |

- **SLA default**: 24 h wall-clock (`maxAgeSec: 86400`) OR 17,280 ledgers
  (≈24 h at 5 s/ledger) — whichever clock the checker is given. Operators set
  a tighter SLA per jurisdiction; the checker takes `--max-age-sec` /
  `--max-age-ledgers`.
- **Two clocks**: `timestamp` (wall) and `boundLedger` (chain). The checker
  uses wall-clock when `--now` is given (default: current time) and ledger
  distance when `--current-ledger` is given. Either suffices; both is best.
- **Failure mode**: a checker STALE verdict MUST page the issuer (attestation
  pipeline down), never auto-submit (no key lives in the monitor).
- **Out of scope**: changing `/api/solvency` shape (v1 frozen) — freshness is
  computed by CONSUMERS from the existing `timestamp`/`boundLedger` fields.

## Checker contract

`node scripts/check_badge_freshness.js --status <file|url> [--max-age-sec N]
[--now ISO] [--current-ledger N] [--max-age-ledgers N]`

- Exit 0 `FRESH`, exit 2 `STALE:<reason>`, exit 1 `ERROR:<reason>`
  (unreadable input, missing timestamp AND ledger, future timestamp).
- Never fetches anything except the given `--status` URL (file mode is
  fully offline — that is what CI runs).
