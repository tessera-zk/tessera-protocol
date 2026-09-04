# Membership contract notes (issue #12)

Coupling to keep in mind when implementing `unregister_customer_key` /
`registry_version` / depth migration:

- `SIGNED_SOLVENCY_LEAVES = 4` (depth 2) is a compile-time const; the pin
  requires registered count == proof key count == const. Dynamic membership
  needs either (a) const per deployment + migration ceremony, or (b) a
  variable-length pin with a circuit supporting padding (NOT-YET, needs a
  padded-signed-circuit design + audit).
- `DataKey::SignedEpoch` monotonicity must survive removals (no epoch reset).
- `DataKey::Latest` writes (FIX 4) must keep pointing at the newest
  healthy root across membership changes so `verify_inclusion` stays bound.
- Events to add: `registry/add`, `registry/remove` (old index, new count,
  version), so the frontend archive stays reconstructible.
- Tests to add with the change: remove-then-submit-old-epoch rejects (#14),
  submit-with-stale-key-set rejects (#10), count-mismatch rejects (#10).
