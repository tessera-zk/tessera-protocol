# Handoff — Tessera ZK

Last updated: 2026-09-04. Repo: `github.com/tessera-zk/tessera-protocol`
(org `tessera-zk`, free plan). Local checkout: `/home/marcus/tessera-protocol`.

## State (all verified this session)

- Branch: only `main` exists, locally and remotely (95 commits). Clean tree.
- Issues: 0 open. PRs: 0 open (PRs #1–4 old, #15–24 batch, #26, #28, #30).
- CI: circuits / contract / frontend / docs workflows all green on `main`.
- Community standards: 9/9 on the repo community page.
- Contract tests: 26 passed (`cd contracts && cargo test -p tessera-ledger`).

## Verify-from-scratch commands

```bash
git pull --ff-only                                    # main, up to date with origin/main
cd contracts && cargo test -p tessera-ledger          # 26 passed
node scripts/check_secret_hygiene.js                  # secret hygiene OK
gh run list --repo tessera-zk/tessera-protocol --branch main --limit 4
gh api repos/tessera-zk/tessera-protocol/community/profile --jq '.health_percentage'
```

## Known quirks (don't re-debug)

- REST `community/profile` reports `issue_template: false` and `health: null`
  even when green — it is blind to YAML issue forms (same for
  `vercel/next.js`). The community UI page is the arbiter; parse its
  `octicon-check` markers if scripting.
- GraphQL `issueTemplates` likewise omits YAML forms (returns only `.md`).
- Frontend lockfile is npm-11-generated; CI pins `npm@11` (npm 10's `npm ci`
  rejects it — reproduced). Don't downgrade the pin.
- Never `npx circom` (wrong JS package); CI downloads the 2.2.3 Rust binary.
- `NEXT_PUBLIC_*CONTRACT_ID/RPC_URL` are public config — only `*SECRET`
  trips the hygiene gate.

## Roadmap pointer

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for track status. Suggested resume
order: two-signer multi-holder tx → unified phase-2 → keyed-risk audit →
Reflector scratch trial → ceremony planning.
