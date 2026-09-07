# Oracle trial plan (issue #38)

Question: does the off-chain priced-aggregate math from the spike (#10/#20)
behave exactly as the future contract entrypoint must? Trial scope is the
math + rejection rules, using a deterministic mock — NOT live Reflector, NOT
contract wiring.

## What the trial proves (all executed, see results doc)

1. Exact fixed-point scaling (`balance * priceNum / 1e7`), truncation
   direction (down, never up).
2. Staleness boundary: `current - priceLedger <= 100` passes at 100, rejects
   at 101 with `STALE_PRICE`.
3. Non-positive quotes reject with `BAD_PRICE` (covers oracle malfunction and
   the mock negative scenario).
4. Missing quotes: zero legs aggregate to 0 (backs nothing); there is no
   default-price path.
5. Two-leg aggregate matches hand computation (223,456 on the fixture book).
6. BigInt exactness at 2^100 (no float anywhere in the path).

## What the trial does NOT prove

- Live Reflector reads, feed IDs, or ledger-time semantics.
- Contract-side checked-i128 arithmetic (must mirror these semantics in the
  future `submit_multi_attestation_priced`).
- Decimal handling for assets with non-7dp feeds (normalization TBD).
