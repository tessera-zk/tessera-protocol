# Contract hardening record (issue #40) — REAL run, 2026-09-07

Command: `cd contracts && cargo test -p tessera-ledger`

```
test result: ok. 35 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

26 pre-existing tests untouched and green; 9 new `hardening_tests::` tests:

```
zero_is_canonical, small_values_are_canonical, modulus_minus_one_is_canonical,
modulus_itself_is_not_canonical, all_ff_is_not_canonical,
adjudicated_error_codes_are_stable, error_discriminants_are_unique,
signal_count_consts_match_circuits, ge_be_edges
```

## Fixes required to get green (both in the new module, no logic touched)

1. Extra paren in `all_ff_is_not_canonical` — compile error, caught by cargo.
2. `sorted.dedup()` — unavailable: the contract is `no_std` and fixed arrays
   lack slice sort here. Rewrote uniqueness as a nested-loop scan. Lesson for
   future test PRs: core-only APIs in this crate.

No production code changed except the two-line `mod hardening_tests;`
wiring. The M3/canonical, error-code, and arity properties now fail loudly
instead of drifting silently.
