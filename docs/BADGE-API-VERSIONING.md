# Badge API versioning (issue #6)

Current version: **1**.

## v1 (this PR)

- `GET /api/solvency` → JSON with `ok, status, contract, epoch,
  totalCommitments, treasury, boundTreasury, liveReserveBalance, ratioPct,
  rootHash, treasuryHolder, controlProven, nonOmissionInCircuit, boundLedger,
  timestamp, tx`. Header `x-tessera-api-version: 1`, `cache-control: no-store`.
- `GET /api/badge/svg` → SVG badge. Headers `x-tessera-badge`
  (`healthy|pending`), `x-tessera-api-version: 1`, `cache-control: no-store`.

## Rules

1. Additive fields are minor (no version bump) and documented here.
2. Renames, removals, or status-enum changes bump to v2 and keep v1 for one
   release with a `Deprecation` header.
3. The SVG dimensions (220×28) are stable in v1; color values may be tuned
   without a bump.
