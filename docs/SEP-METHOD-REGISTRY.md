# SEP method registry (issue #70 — v0.2 DECISION on checklist box 3)

**Decision**: closed registry with a reserved prefix. `method` values starting
with `groth16-`, `tessera-`, or `self-declared` are RESERVED — unlisted values
with those prefixes warn `UNREGISTERED_METHOD` (namespace-squat protection is
a validator warning, not a schema error: the schema validates STRUCTURE).

Rules (enforced by `scripts/validate_sep.js`):

1. Every record's `method` SHOULD be listed here. Unlisted methods are
   shape-valid but warn — consumers MUST treat the evidence claim as unverified.
2. The `non_omission` tier MUST be evidenced by the method: only the signed
   method evidences `in-circuit`. Anything else claiming `in-circuit` warns
   `TIER_METHOD_MISMATCH` (the tier-conflation failure mode).
3. New methods are added by SEP revision (never unilaterally): name, version
   suffix `/n`, tier coverage, and a pointer to the proving-system spec.

## Registered methods

| Method | Tiers evidenced | Meaning |
|---|---|---|
| `groth16-bn254-merkle-sum/1` | none, vigilance | Base health: non-negative commitments, correct Merkle-sum root, `total <= reserves`, reserve binding + control proof on-chain |
| `groth16-bn254-signed-merkle-sum/1` | none, vigilance, **in-circuit** | Base health PLUS every leaf's Baby-JubJub EdDSA signature verified in-circuit AND signer keys pinned on-chain to the member-self-registered list |
| `groth16-bn254-risk-merkle-sum/1` | none, vigilance | Base health PLUS per-leaf concentration cap + min collateralization floor in ZK |
| `self-declared/1` | none | No proof. Assurance-free by definition |

`vigilance` (bulletin-board detectability) is a DEPLOYMENT property no method
string can prove — methods evidence at most the tier listed; reaching
`vigilance` additionally needs the signed-leaf registry path documented in
`ADVANCED-STATUS.md` UPGRADE 1.
