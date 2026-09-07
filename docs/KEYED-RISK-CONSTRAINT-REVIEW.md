# Keyed-risk constraint review (issue #37)

Line-by-line audit of `circuits/lib/keyed_risk_tpl.circom` against the FIX 3
hole (unconstrained `acctCommit[]` letting a whale split across leaves).

## Findings

1. **FIX 3 hole closed in-prototype.** There is no `acctCommit` private input
   anymore: `acct[i] = Poseidon(3)` over `(Ax[i], Ay[i], nonces[i])`, and
   `leaf[i] = Poseidon(2)` over `(acct[i].out, balances[i])`. A leaf's
   identity cannot be separated from its signer key — the exact property the
   live `risk_solvency` circuit lacks.
2. **Range hygiene present.** `balances` via `Num2Bits(balanceBits)`,
   `reserves` via `Num2Bits(cmpBits)`, `maxConcBps`/`minCollBps` via
   `Num2Bits(16)`. No field-wrapped bypass for bounds or the base quantity.
3. **Comparator widths.** `bpsBits = balanceBits + depth + 16 + 1` covers
   `balance*10000` (balanceBits+14) vs `maxConcBps*total`
   (16+balanceBits+depth). No truncation at depth ≤ 10.
4. **Solvency intact.** `LessEqThan(cmpBits)` on
   `totalLiabilities <= reserves` with `cmpBits = balanceBits+depth+1` —
   identical to the audited `solvency_tpl` shape.
5. **Residual gap (NOT a circuit bug): Sybil.** One human holding two
   registered keys still splits across two keyed positions. Enforced
   per-position, claimed per-position — no overclaim. Policy fix required
   (see `docs/KEYED-RISK-SYBIL-POLICY.md`), not a constraint fix.
6. **Missing vs signed_solvency: no signatures.** The prototype binds keys
   but does not verify EdDSA signatures over leaves. A keyed leaf is
   attributable, not authenticated. Merging `EdDSAPoseidonVerifier` (as in
   `UnifiedSolvency`) is on the remediation list.

Verdict: prototype is sound for "per-keyed-position concentration" and
honestly scoped. Deploy blockers are in `docs/KEYED-RISK-REMEDIATION.md`.
