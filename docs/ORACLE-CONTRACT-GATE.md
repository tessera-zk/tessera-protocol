# Oracle contract gate (issue #38)

`submit_multi_attestation_priced` MUST NOT land until every box is checked.
This gate is the acceptance list; the trial above covers the off-chain half.

## Math parity (contract must mirror the trialed semantics exactly)

- [ ] Fixed-point denominator 10^7, truncation toward zero (not banker's).
- [ ] Staleness: `current_ledger - price_ledger <= 100` else reject; bound
      configurable per deployment and emitted in oracle-config event.
- [ ] Missing/negative/zero price → reject (no default, no 1:1 fallback).
- [ ] Checked i128 ops; overflow → explicit error (never saturate).

## Oracle binding

- [ ] Prices read ONLY from the configured Reflector contract (no issuer arg).
- [ ] Feed IDs pinned at oracle-config time; unknown asset → reject.
- [ ] `set_reserve_legs` non-1:1 stays rejected on the SAME-UNIT path; priced
      legs travel the NEW entrypoint only (audited path untouched).

## Tests required (contract suite)

- [ ] Stale / missing / negative price each reject with a distinct error.
- [ ] Overflow fixture returns the explicit error.
- [ ] Hand-computed aggregate (223,456 fixture) matches on-chain.
- [ ] Per-holder `require_auth` still required for every leg.
- [ ] Existing 26 tests stay green.

## Process

- [ ] Audit review of the new entrypoint before testnet use.
- [ ] Testnet demo with real Reflector quotes recorded like any other tx.
