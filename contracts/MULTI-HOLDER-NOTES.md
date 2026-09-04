# Multi-holder contract notes (issue #7)

Reference for contributors touching `submit_multi_attestation` /
`set_reserve_legs` / `aggregate_reserves` in `contracts/tessera-ledger/src/lib.rs`.

- `set_reserve_legs(legs)`: rejects any leg with `scale_num != 1 ||
  scale_den != 1` → Error #13 (`BadReserveLeg`). Tested by
  `set_reserve_legs_non_1to1_rejected`.
- `aggregate_reserves()`: sums live `token.balance(holder)` per leg as i128;
  overflow → Error #15 (explicit, FIX 5). Never saturates silently.
- `submit_multi_attestation(proof, signals)`: verifies base health proof,
  calls `holder.require_auth()` per leg, enforces
  `treasury <= aggregate`, writes `DataKey::Latest` (FIX 4) so
  `verify_inclusion` binds to the multi root, emits `attest/multi`.
- Testnet record: single-signer two-asset tx `f8631c70…` (aggregate 189140,
  leg_count 1). Two-signer tx is NOT-YET on testnet — use
  `scripts/testnet_multi_holder_demo.sh` to produce it.
- Do NOT reintroduce issuer-set pricing without a Reflector binding
  (issue #10). Any `scale != 1:1` change must come with an oracle design doc.
