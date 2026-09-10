# Verify commands (issue #44; refreshed #74) — copy-paste re-verification

All read-only except where noted. Expected outputs inline.

```bash
# 1. Contract suite: expect 62 passed, 0 failed
cd contracts && cargo test -p tessera-ledger

# 2. Unified setup chain: expect VERIFY PASS + pinned hashes
bash scripts/verify_unified_setup.sh

# 2b. Unified positive control: expect pass=2 fail=0
bash scripts/prove_unified_positive.sh

# 2c. R1 keyed-risk vectors: expect pass=5 fail=0
bash scripts/run_keyed_risk_r1_vectors.sh

# 3. Oracle math: expect 9 pass, 0 fail
node --test scripts/oracle_math.test.js

# 4. Keyed-risk vectors: expect 4 as-expected, 0 unexpected
bash scripts/run_keyed_risk_vectors.sh

# 4b. SDK: expect 18 pass, 0 fail
node --test sdk/test/*.test.js

# 4c. SEP records: expect all blocks valid (schema + strict)
node scripts/validate_sep.js --doc docs/SEP-ATTESTATION-EXAMPLES.md
node scripts/validate_sep.js --strict --doc docs/SEP-ATTESTATION-EXAMPLES.md
node --test scripts/validate_sep.test.js

# 5. Secret hygiene: expect OK
node scripts/check_secret_hygiene.js

# 6. Provisioning grade for THIS machine: expect NO-GO depth-10 (RAM), GO depth-4
node scripts/provision_preflight.js --depth=10
node scripts/provision_preflight.js --depth=4

# 7. Pack hygiene: expect SELFCHECK PASS
node scripts/evidence_selfcheck.js

# 8. Caveat grep: expect hits in README, circuits README, ADVANCED-STATUS, SECURITY
grep -rl "single-contributor" README.md circuits/README.md ADVANCED-STATUS.md SECURITY.md
```

Testnet spot-checks (need network + Stellar Expert, no keys):

- `e506122203af411ff41ddf7628be9e1731060de2c58770b4a39e81492f5a4e62`
  → successful, bound attestation stored.
- `cec46e6cfdba18d6bfefdb61633d017aa6a0be66ff38e90cae231f87ae6ee7ef`
  → successful signed attestation, ledger 3396983.
