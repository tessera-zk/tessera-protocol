# Cross-asset design (issue #10)

## Goal

`treasury (base units) <= sum_i balance_i * price_i` with every `price_i`
from Reflector on-chain, staleness-bounded, overflow-explicit.

## Decisions

1. Base unit fixed at oracle-config time (e.g. USDC). Legs declare asset codes.
2. Staleness: `current_ledger - price_ledger <= 100` else reject (tunable per
   deployment, recorded in `set_oracle_config` event).
3. Decimals: Reflector 7dp fixed (`PRICE_DENOMINATOR = 10_000_000`); all math
   in i128 checked ops; overflow → explicit error.
4. Missing/stale/negative price → reject attestation (never default).
5. `set_reserve_legs` non-1:1 stays rejected until this path ships; the priced
   path is a NEW entrypoint (`submit_multi_attestation_priced`) so the audited
   same-unit path is untouched.

## Tests required before audit

- Stale price rejects; missing price rejects; negative price rejects.
- Overflow case returns explicit error (not saturate).
- Mixed-leg aggregate matches hand-computed fixed-point value.
- Per-holder `require_auth` still required for every leg.
- Same-unit path unchanged (existing 25 tests green).
