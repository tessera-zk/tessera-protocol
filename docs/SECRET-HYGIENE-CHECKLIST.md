# Secret-hygiene checklist (issue #14, FIX 5 / H2)

- Treasury signing key lives ONLY in `frontend/.env.local` as
  `TESSERA_TREASURY_SECRET` (server-side, never `NEXT_PUBLIC_`, never pasted
  into a UI field). See `frontend/README.md`.
- Signing happens server-side (`frontend/lib/server/*`, `/api/*`); the browser
  never sees the secret.
- CI gate: `frontend.yml` runs `node scripts/check_secret_hygiene.js`; docs
  gate in `docs.yml` forbids `NEXT_PUBLIC_*SECRET` in markdown.
- Rotation: new secret → `.env.local` → restart frontend → old secret
  revoked at the signer account. No code change needed.
- Incident: if a secret ever ships client-side, rotate immediately and note
  the exposure window in the attestation record (do not rewrite history).
