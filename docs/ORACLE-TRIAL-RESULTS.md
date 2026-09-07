# Oracle trial results (issue #38) — REAL runs, 2026-09-07

## Unit suite: `node --test scripts/oracle_math.test.js`

```
# tests 9
# pass 9
# fail 0
```

9 cases: module load, exact 2.0 scaling, fractional truncation (100 @
0.1234567 → 12), staleness boundary 100-pass/101-reject, mock stale rejects,
negative + zero price reject, missing-price aggregates to 0, two-leg
hand-computation match (223,456), 2^100 BigInt exactness.

## Demo: `node scripts/priced_aggregate_demo.js`

- `--treasury=223456` → `aggregate=223456` → BACKED (boundary equality holds).
- `--treasury=300000` → `aggregate=223456` → UNBACKED (correctly refuses).

## Mock: `node scripts/mock_reflector.js --scenario=stale`

Emits the stale USDC quote (`priceLedger: 49500` vs `currentLedger: 50000`,
age 500 > 100) that the suite asserts rejects.

All green. Contract wiring remains gated on `docs/ORACLE-CONTRACT-GATE.md`.
