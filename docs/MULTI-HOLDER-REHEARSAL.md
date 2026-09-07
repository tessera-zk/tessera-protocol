# Two-signer rehearsal procedure (issue #35)

Rehearses the NOT-YET two-signer multi-holder tx end-to-end WITHOUT spending
fees: every pre-submit check runs off-chain, and the submit step is a printed
invocation the operator pastes when funded. Nothing here fabricates a tx hash.

## Roles

- Operator: runs the scripts, holds no keys.
- Holder A / Holder B: distinct testnet identities, each authorizing ONLY its
  own leg. Same person must never hold both keys (else the control proof
  degrades to the single-signer caveat in `docs/MULTI-HOLDER-TRUST.md`).

## Steps

1. Fund check: both holders exist with stroops for fees.
   `node scripts/multi_holder_checklist.js --holders A,B` (exits non-zero
   listing what is missing).
2. Legs file: write `legs.json` (holder, token per leg, both same unit).
   `node scripts/collect_holder_auths.js --legs legs.json --out auths.json`
   validates shape + 1:1 scale and prints the per-holder signing instructions.
3. Aggregate preview: `node scripts/verify_multi_aggregate.js --legs legs.json
   --balances 100000,89140` confirms `treasury <= sum` before any fee is spent.
4. Declared reserves: pick `treasury <= aggregate`; record it in the evidence
   file FIRST (prevents post-hoc fitting).
5. Submit (funded step): paste the printed `stellar contract invoke` with BOTH
   `--source`/auth entries. Capture tx hash + ledger.
6. Verify: `node scripts/parse_multi_events.js --tx <hash>` checks
   `attest/multi` carries `leg_count 2` and the stored root matches.
7. File evidence per `docs/MULTI-HOLDER-EVIDENCE-TEMPLATE.md`.

## Abort rules

- Any checklist failure → stop, fix, re-run from step 1.
- `leg_count != 2` in the event → the tx is single-signer; do NOT claim
  multi-holder control. Record honestly and retry.
