# Registry API — current + proposed (issue #12)

## Shipped (FIX 1, `lib.rs`)

- `register_customer_key(customer: Address, ax: BytesN<32>, ay: BytesN<32>)`
  — `customer.require_auth()`; appends to ordered list; canonical `< r`
  check (Error #16 on non-canonical).
- `is_registered_key(ax, ay) -> bool`, `registered_key_count() -> u32`.
- `submit_signed_attestation(...)` — pins public `(Ax_i, Ay_i)` against the
  list position-by-position (Error #10), checks epoch monotonicity (#14).

## Proposed (NOT-YET, needs design review + tests)

- `request_leave(customer)` — member-authorized intent; emits event, does not
  mutate the pin set (issuer must still prove over the member until removal).
- `unregister_customer_key(customer, ax, ay)` — admin + member dual auth
  (or timelocked admin after grace epochs); compacts the ordered list; emits
  `registry/remove` with old index + new count.
- `registry_version() -> u32` — bumps on every add/remove; signed proofs bind
  the version they were built over (replay across versions rejected).
- Migration: depth change = new deployment; `MEMBERSHIP-NOTES.md` records the
  `SIGNED_SOLVENCY_LEAVES` coupling and the re-registration ceremony.

No method here is implemented in this PR; the doc pins the interface so the
contract diff stays reviewable when it lands.
