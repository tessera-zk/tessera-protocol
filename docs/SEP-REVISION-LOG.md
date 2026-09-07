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
