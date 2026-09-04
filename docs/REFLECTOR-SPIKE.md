# Reflector oracle spike (issue #10)

Status: **research spike only. NOT wired to the contract. Same-unit 1:1
remains the enforced rule (Error #13).**

FIX 2 honestly downgraded multi-asset to same-unit aggregation because
`scale_num/scale_den` were issuer-set prices. Real cross-asset backing needs
an on-chain price source. On Stellar that is **Reflector** (oracle contract
publishing prices on-chain).

## What Reflector provides (to verify against docs)

- On-chain price feeds (e.g. USDC/XLM, asset pairs) readable cross-contract.
- A subscriber reads the latest price + timestamp/ledger at submit time.
- Staleness bounds: caller enforces `now - price_timestamp <= MAX_STALENESS`.

## Integration sketch (NOT implemented)

```
declared_reserves (same unit, e.g. USDC)
  <= sum_i balance(holder_i, token_i) * price(token_i -> USDC)  [from Reflector]
```

Contract changes required (see `contracts/oracle-spike/oracle_trait.rs` stub):

1. `set_oracle_config(reflector_contract, base_asset, max_staleness)` (admin).
2. `aggregate_reserves_priced()` reads each leg balance + Reflector price,
   rejects stale/missing prices, computes scaled sum with explicit overflow
   error (never silent).
3. `submit_multi_attestation_priced(...)` enforces
   `treasury <= priced_aggregate` + per-holder `require_auth`.
4. Non-1:1 `set_reserve_legs` stays rejected until this path is audited.

## Why NOT in this PR

Oracle binding is consensus-critical: wrong staleness bounds, decimal handling,
or missing-price defaults recreate the fake-backing hole FIX 2 closed. This
spike documents the interface and risks; any price math lands behind a new
audited entrypoint, never by relaxing Error #13.

References: Reflector docs (verify URL at implementation time),
`docs/CROSS-ASSET-DESIGN.md`, `docs/REFLECTOR-SPIKE.md` evidence checklist.
