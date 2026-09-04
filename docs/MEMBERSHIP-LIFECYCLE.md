# Dynamic membership lifecycle (issue #12)

Status: **design + helpers. Contract change is NOT-YET; fixed depth-2/4
counts remain enforced on-chain.**

ADVANCED-STATUS NOT-YET: demo signed circuit is depth 2 (exactly 4 members).
Production parameterizes depth and supports add/remove with a re-proof per epoch.

## Lifecycle

1. Join: member generates Baby-JubJub key, calls `register_customer_key`
   under their own auth. Off-chain the issuer includes them next epoch.
2. Active: every epoch the issuer proves over EXACTLY the registered ordered
   list; `submit_signed_attestation` pins keys position-by-position
   (Error #10 on mismatch), epoch strictly increases (Error #14).
3. Leave: member requests removal; issuer rotates to a new instance or a
   future `unregister_customer_key` (NOT-YET) tombstones the slot; the epoch
   after removal proves over the new list. Historical attestations stay
   verifiable (old roots + old key lists archived by the frontend).
4. Depth change: book outgrows depth → new circuit instance at depth+1 with a
   fresh setup; contract stores `SIGNED_SOLVENCY_LEAVES` per deployment
   (migration runbook in `docs/REGISTRY-API.md`).

## Rules (until contract supports it)

- No silent removal: a registered key missing from a proof's public keys is
  rejected (#10), so removal must be an explicit, member-visible transaction.
- Frontend must show `registered_key_count()` vs proof key count before submit
  (`frontend/lib/membership.ts`).
- Epochs never reuse (replay #14); membership change = new epoch.

## Files

- `docs/REGISTRY-API.md`, `frontend/lib/membership.ts`,
  `scripts/membership_check.js`, `docs/MEMBERSHIP-CHECKLIST.md`,
  `contracts/MEMBERSHIP-NOTES.md`.
