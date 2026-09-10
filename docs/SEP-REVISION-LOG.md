# SEP revision log (issue #43)

## v0.1 (this PR — draft, not submitted)

Initial record format, JSON schema, two examples, FAQ, review checklist.
Tiers: in-circuit / vigilance / none. Stellar-only address patterns.

## v0.2 candidates (not decided)

- `method` registry: free-form strings vs a registered method list with
  versioned semantics.
- Fork evidence: conflicting-record detection rules using `epoch` +
  `bound_ledger`.
- Multi-chain address encodings (Ethereum, Solana) alongside Stellar.
- Proof-byte attachment format (or explicit decision to keep proofs off-record).
- Governance: who approves method registrations and tier upgrades.
- Canonical JSON serialization (key order, whitespace) for byte-identical
  records across implementations.

## v0.2 (this PR — policy layer, schema-COMPATIBLE, not submitted)

No schema change: every v0.1-valid record validates identically (the committed
validator enforces the UNCHANGED `SEP-ATTESTATION-SCHEMA.json`). v0.2 adds:

- **Method registry** (`docs/SEP-METHOD-REGISTRY.md`): closed list, reserved
  prefixes, tier-coverage per method. Resolves the free-form-vs-registry
  candidate as registry-with-warnings (unknown methods stay shape-valid).
- **Policy warnings** in `scripts/validate_sep.js`: `TIER_METHOD_MISMATCH`
  (tier-conflation) and `UNREGISTERED_METHOD` (unverifiable evidence claim).
- **Canonicalization** (`canonicalize`, sorted-keys compact JSON): two
  constructions of one record produce identical bytes (tested).
- **Live records** Ex.3 (signed epoch-2, `in-circuit`) + Ex.4 (two-holder
  multi epoch-1, `none`) from fresh-contract testnet txs.
- **Muxed addresses**: intentionally EXCLUDED from holder patterns in v0.2
  (plain `G...` only); muxed support is the v0.3 candidate, not silently
  dropped — recorded here.

Deferred to v0.3+: fork-evidence rules, multi-chain encodings, proof-byte
attachment decision, method governance (all need community input — see the
submission packet's review asks).
