# Keyed-risk remediation list (issue #37)

Ordered blockers before any keyed-risk claim is enforced on-chain. Nothing
here is started — this list is the definition of done.

| ID | Item | Owner hint | Depends on |
|---|---|---|---|
| R1 | Merge `EdDSAPoseidonVerifier` per leaf (as in `UnifiedSolvency`) so keyed leaves are authenticated, not just attributable | Circuits | — |
| R2 | Adopt Sybil stance B (identity-gated registration) for regulated issuers, keep D disclosed for others | Product + Compliance | Sybil policy doc (done) |
| R3 | New entrypoint `submit_keyed_risk_attestation` with full pin (keys order, count, epoch monotonicity, reserve binding, per-holder auth) | Contracts | R1 |
| R4 | Unit tests: stale-key-set rejects (#10), count-mismatch rejects (#10), split-position still passes per-position (documents scope) | Contracts | R3 |
| R5 | Testnet demo: honest keyed-risk submit + omission attempt rejected | Testnet | R3, R4 |
| R6 | Regenerate unified/keyed setup artifacts from R1 circuit (new r1cs hash, new ceremony-track record) | Circuits | R1 |

Deliberately NOT on this list: changing the live `risk_solvency` claim —
it stays honestly per-LEAF until R1–R5 land.
