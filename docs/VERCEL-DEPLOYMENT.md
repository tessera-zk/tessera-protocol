# Vercel deployment (live 2026-09-10)

**Always-test link (production): https://tessera-frontend-pink.vercel.app**

Board, issuer, inclusion, badge pages + `/api/solvency` JSON + badge SVG all
verified 200 on 2026-09-10. `/api/solvency` reads the live §2 contract
(returned the epoch-2 signed attestation at deploy time).

## Project

- Vercel project `abokisubme/tessera-frontend`, root directory `frontend/`,
  Next.js 15.5.25 (Vercel REFUSES 15.5.4 — vulnerable-version gate; see PR #77).
- Deploys track `main` via CLI (`vercel deploy --prod` from `frontend/`);
  link config (`.vercel/`) stays local (gitignored).

## Environment (names only — values live in Vercel + local `.env.local`)

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_TESSERA_CONTRACT_ID` | Production | §2 contract (baked at build time) |
| `NEXT_PUBLIC_RPC_URL` / `NEXT_PUBLIC_HORIZON_URL` / `NEXT_PUBLIC_NETWORK` | Production | testnet endpoints |
| `TESSERA_CONTRACT_ID` / `RPC_URL` | Production | server-side contract reads |
| `TESSERA_TREASURY_SECRET` | Production (sensitive) | server-only (`lib/server`), NEVER `NEXT_PUBLIC_*` — secret-hygiene gate enforced in CI |

## Gotchas hit during setup (do not regress)

1. `frontend/app/globals.css` carried a pasted Read-tool footer line that
   broke `next build` (PostCSS "Unknown word") — removed in PR #76.
2. Vec-of-struct CLI args need `--<arg>-file-path` with i128 as JSON strings
   (unrelated to Vercel, recorded for operators).
3. `vercel env add <name> preview` prompts for a git branch (interactive) —
   production envs set via stdin pipes; preview inherits nothing automatically.

## Redeploy

```bash
cd frontend
vercel deploy --prod --yes   # builds remotely (~2 min), promotes alias
curl -s https://tessera-frontend-pink.vercel.app/api/solvency | head -c 300
```
