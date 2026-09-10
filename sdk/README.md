# @tessera-zk/sdk (scaffold, issue #42)

Client helpers for Tessera treasury attestations. Reads + embeds only —
**no secrets, no signing**. The signing key stays server-side in the
issuer's frontend (see `docs/SECRET-HYGIENE-CHECKLIST.md`).

## 5-minute integration

```js
import { fetchStatus } from "@tessera-zk/sdk/reads";
import { badgeEmbedHtml } from "@tessera-zk/sdk/embed";
import { isFullyBacked } from "@tessera-zk/sdk/types";

const status = await fetchStatus("https://issuer.example");
if (isFullyBacked(status)) console.log("backed", status.ratioPct);
document.body.innerHTML = badgeEmbedHtml("https://issuer.example");
```

Try it with zero setup: `node sdk/example.js` (stub fetch, real code path).

## API

- `reads.statusUrl(origin)` / `reads.fetchStatus(origin, fetch?)` — v1 JSON,
  shape-checked (`BAD_STATUS` on mismatch, `STATUS_HTTP_n` on transport error).
- `embed.badgeSvgUrl(origin, label?)` / `embed.badgeEmbedHtml(origin, label?)`.
- `types.isFullyBacked(s)` — `healthy` AND `controlProven` (the full bar, not
  just the headline status).

## Status

Scaffold (private package, NOT published). CI covers `sdk/**` (`.github/workflows/sdk.yml`:
15 unit tests, example run, publish-gate refusal, pack dry-run, secret hygiene).

## Publish readiness (#68: metadata + gate done, audit-gated remainder open)

- [x] Package metadata: repository/homepage/engines/files/exports/scripts
- [x] `prepublish-check.js` gate: `npm publish` REFUSES until audit clears
      (verified: exit 1 pre-audit; flip `AUDIT_CLEARED` only with a recorded audit)
- [x] Pack contents verified: 6 files, 2.9 kB (`tessera-zk-sdk-0.1.0.tgz`)
- [x] Example prints real epoch-0 values; `isFullyBacked` semantics reviewed
      (healthy AND control-proven — the full bar)
- [ ] External audit of SDK + contract (blocks publish)
- [ ] Changelog + versioning policy (0.1.0 → 1.0.0 at publish)
- [ ] Browser bundle test (imports from a real bundler, not just node)
