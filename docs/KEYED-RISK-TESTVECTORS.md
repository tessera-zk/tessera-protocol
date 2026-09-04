# Keyed-risk test vectors (issue #11, prototype)

## KR-1 even book (should pass checker + future witness)

balances [4000,4000,4000,4000], total 16000, reserves 16800 (105%),
maxConcBps 4000 (each leaf 25% < 40%), minCollBps 10500. PASS.

## KR-2 split whale (checker passes per-position, Sybil caveat visible)

One member's 8000 split as [4000,4000] across two positions + [4000,4000].
Per-position cap passes (25% each) though one human holds 50%. This is the
Sybil gap the prototype does NOT close — recorded, not hidden.

## KR-3 concentrated position (must fail)

balances [12000,2000,1000,1000], total 16000: leaf0 = 75% > 40%.
`check_keyed_risk.js` exits 2; future witness unsatisfiable at `conc[0]`.

## KR-4 thin reserves (must fail)

reserves 16000, minCollBps 10500 → 100% < 105%. Collateral comparator fails.

## KR-5 key mismatch (must be rejected on-chain)

Valid proof over keys != `register_customer_key` order → contract pin
Error #10 (same pattern as FIX 1). Checker cannot catch this; chain does.
