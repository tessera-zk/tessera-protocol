# Unified public-signal order (issue #36) — pinned by real vkey

Source of truth: `circuit-keys/vk_unified_solvency.json` (`nPublic: 14`,
verified by `scripts/verify_unified_setup.sh`). Any future
`submit_unified_attestation` contract method MUST consume signals in exactly
this order — deviation silently verifies the wrong statement.

```
index  signal
-----  ------
0      rootHash
1      totalLiabilities
2      reserves
3      epoch
4-7    Ax[0..3]   (signer key x, one per leaf)
8-11   Ay[0..3]   (signer key y, one per leaf)
12     maxConcBps (per-LEAF cap, FIX 3 scope)
13     minCollBps (collateral floor)
```

Count check: 4 + 2*4 + 2 = 14 = `nPublic`. Matches
`circuits/unified_solvency.circom` main declaration and
`docs/UNIFIED-CIRCUIT.md` § "Public-signal order".

> Proven in practice (#55, 2026-09-10): `scripts/prove_unified_positive.sh`
> asserts all 14 signals against `contracts/artifacts/unified-positive.json`
> and `snarkjs groth16 verify` returns OK. This order is now load-bearing —
> `submit_unified_attestation` (#56) must consume it exactly.

## Contract wiring checklist (NOT-YET — do not implement without these)

- [ ] Canonical `< r` range assert on all 14 signals before `g1_mul` (M3 rule)
- [ ] `(Ax[i], Ay[i])` pinned position-by-position to `register_customer_key`
      order (Error #10 pattern, FIX 1)
- [ ] `epoch` strictly greater than `signed_epoch()` (Error #14 pattern, FIX 4)
- [ ] `treasury <= live aggregate` cross-contract read + per-holder
      `require_auth` (reserve-binding rule, M4/UPGRADE 2)
- [ ] Risk bounds read as public inputs (no issuer override path)
