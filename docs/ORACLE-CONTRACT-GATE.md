# Oracle contract gate (issue #38)

`submit_multi_attestation_priced` MUST NOT land until every box is checked.
This gate is the acceptance list; the trial above covers the off-chain half.

## Math parity (contract must mirror the trialed semantics exactly)

- [x] Fixed-point denominator 10^7, truncation toward zero (not banker's).
      (`PRICE_DENOMINATOR`, Rust i128 `/` truncates; JS trial parity proven by
      `priced_hand_aggregate_matches_trial` = 223456, #64.)
- [x] Staleness: `current_ledger - price_ledger <= 100` else reject; bound
      configurable per deployment and emitted in oracle-config event.
      (`max_staleness_ledgers`, `treasury/oracfg` event carries the bound, #64.)
- [x] Missing/negative/zero price → reject (no default, no 1:1 fallback).
      (#25/#24/#24, #64.)
- [x] Checked i128 ops; overflow → explicit error (never saturate).
      (`ReserveOverflow` #15 reused, `priced_overflow_is_explicit`, #64.)

## Oracle binding

- [x] Prices read ONLY from the configured Reflector contract (no issuer arg).
      (`OracleConfig.reflector`, contractclient trait; mock in tests, #64.)
- [x] Feed IDs pinned at oracle-config time; unknown asset → reject.
      (`OracleConfig.feeds`, `UnknownPriceFeed` #26, #64.)
- [x] `set_reserve_legs` non-1:1 stays rejected on the SAME-UNIT path; priced
      legs travel the NEW entrypoint only (audited path untouched).
      (`submit_priced_attestation`; no existing line changed except additive
      enum/storage variants, #64.)

## Tests required (contract suite)

- [x] Stale / missing / negative price each reject with a distinct error.
      (#23/#25/#24 + zero-price #24, #64.)
- [x] Overflow fixture returns the explicit error. (#15, #64.)
- [x] Hand-computed aggregate (223,456 fixture) matches on-chain. (#64.)
- [x] Per-holder `require_auth` still required for every leg.
      (`priced_without_holder_auth_fails`, #64.)
- [x] Existing 26 tests stay green. (44 pre-existing green at branch time;
      suite now 52/52, #64.)

## Process

- [ ] Audit review of the new entrypoint before testnet use.
- [ ] Testnet demo with real Reflector quotes recorded like any other tx.

> Status 2026-09-10 (#64): math + binding + tests LANDED and green in CI.
> Process boxes stay OPEN: `submit_priced_attestation` is NOT FOR TESTNET/
> PRODUCTION USE until the audit + real-Reflector demo land. The mock-oracle
> path is unit-test-only by construction (reflector address is config).
