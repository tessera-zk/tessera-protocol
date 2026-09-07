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

Scaffold (private package, NOT published). Publish checklist before npm:
versioning policy, changelog, browser bundle test, `isFullyBacked`
semantics review with compliance.
