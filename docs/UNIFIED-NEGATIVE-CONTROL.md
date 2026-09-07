# Unified negative control (issue #36) — REAL run, 2026-09-07

Claim under test: a witness built over placeholder (all-zero) signer keys is
UNPROVABLE — forgery fails inside the circuit, not at the contract.

## Procedure

```bash
node scripts/gen_unified_input.js > /tmp/unified_in.json   # Ax=Ay=S=R8x=R8y=0
snarkjs wtns calculate build/unified/unified_solvency_js/unified_solvency.wasm \
  /tmp/unified_in.json /tmp/unified_neg.wtns
```

## Result

Exit 1. Failure lands exactly where the security property lives:

```
ERROR:  Error in template EdDSAPoseidonVerifier_168 line: 83
Error in template UnifiedSolvency_324 line: 66
[ERROR] snarkJS: Error: Assert Failed. Error in template EdDSAPoseidonVerifier_168 line: 83
```

No `.wtns` produced, so no proof can exist for unsigned leaves. A forged
signature fails at the same assertion. This mirrors the signed_solvency
guarantee (ADVANCED-STATUS.md FIX 1) now measured on the unified circuit.

## What remains

A positive control (real member signatures → valid witness → valid proof)
needs per-leaf Baby-JubJub keys + signatures from `gen_signed_demo.js`
wired into `gen_unified_input.js`. NOT run — recorded as the next step.
