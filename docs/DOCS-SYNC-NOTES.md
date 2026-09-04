# Docs-sync notes — this round (issue #14)

Files added this round and the source they must stay synced with:

- `docs/UNIFIED-CIRCUIT*.md` ↔ `circuits/lib/unified_solvency_tpl.circom`
  (signal order, constraint estimate).
- `docs/BADGE*.md` ↔ `frontend/app/api/solvency/route.ts` +
  `frontend/app/api/badge/svg/route.ts` (fields, headers, version 1).
- `docs/MULTI-HOLDER-*.md` + `contracts/MULTI-HOLDER-NOTES.md` ↔ `lib.rs`
  multi entrypoints (Errors #13/#15, `attest/multi`).
- `docs/DEPTH10-*.md` ↔ `BENCHMARKS.md` (depth-8 verified point unchanged).
- `docs/TRUSTED-SETUP-*.md` + `SECURITY.md` ↔ `circuits/README.md`
  disclosure (single-contributor caveat everywhere).
- `docs/REFLECTOR-SPIKE.md` + `docs/CROSS-ASSET-DESIGN.md` ↔ FIX 2 rule
  (1:1 enforced, no issuer prices).
- `docs/PER-MEMBER-*.md` + `docs/KEYED-RISK-*.md` ↔ FIX 3 scope (live = per-LEAF).
- `docs/MEMBERSHIP-*.md` + `docs/REGISTRY-API.md` ↔ FIX 1/4 (pin #10, epoch #14).
- `docs/PROVER-ERRORS.md` ↔ `frontend/lib/errors.ts` (11 codes).

Rule (CONTRIBUTING.md): any PR changing a source above updates its doc line
or states why not. `docs.yml` link-check enforces cross-links resolve.
