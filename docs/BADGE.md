# Embeddable badge + JSON status endpoint (issue #6)

Status: **shipped as frontend polish. NOT an audited issuer product.**

## Endpoints

| Endpoint | Returns | Cache |
|---|---|---|
| `GET /api/solvency` | Versioned JSON: `{ok, status, contract, epoch, totalCommitments, treasury, boundTreasury, liveReserveBalance, ratioPct, rootHash, treasuryHolder, controlProven, nonOmissionInCircuit, boundLedger, timestamp, tx}` | `no-store` |
| `GET /api/badge/svg?label=Tessera` | SVG 220×28, green `healthy <ratio>` or amber `pending` | `no-store` + `x-tessera-badge` + `x-tessera-api-version: 1` |
| `GET /badge` | Human-readable badge page (existing) | page |

## Embed (copy-paste)

```html
<a href="https://issuer.example/badge" target="_blank" rel="noreferrer"><img
  src="https://issuer.example/api/badge/svg?label=Tessera"
  alt="Tessera treasury health" width="220" height="28" /></a>
```

See `public/badge-embed.html` for a live example. Helper: `frontend/lib/badge.ts`
(`badgeEmbedHtml(origin, label)`).

## Versioning

- Header `x-tessera-api-version: 1` on both JSON and SVG.
- `BADGE_API_VERSION = 1` in `frontend/lib/badge.ts`.
- Breaking changes bump the version and are documented in
  `docs/BADGE-API-VERSIONING.md`.

## Honest limits

- The badge reflects the contract's **latest stored attestation**; freshness
  depends on the issuer submitting each epoch. A stale healthy badge is not
  proof of current health — check `timestamp` / `boundLedger` in the JSON.
- `liveReserveBalance` is best-effort (RPC may be unavailable); the SVG never
  claims liveness beyond the stored attestation.
