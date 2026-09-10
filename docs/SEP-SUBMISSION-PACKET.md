# SEP submission packet (issue #70 — READY, NOT submitted)

Everything below is prepared; nothing has left this repo. Submission = opening
a PR against the SEP repository + notifying reviewers. Do NOT submit before the
audit (the `in-circuit` tier references unaudited circuits).

## Cover note (paste into the SEP PR)

> **SEP-XXX: Standardized Treasury Attestation Record (v0.2)**
>
> Wallets, auditors, and regulators cannot consume issuer health claims
> programmatically: every Stellar issuer attests differently (PDFs, dashboards,
> ad-hoc JSON). This SEP standardizes the RECORD FORMAT — not any proving
> system. Any backend (ZK or otherwise) publishes a conforming record with a
> `method` field declaring how each claim is evidenced and a `non_omission`
> tier declaring EXACTLY how much omission assurance the record carries
> (`in-circuit` / `vigilance` / `none`).
>
> The schema validates STRUCTURE; the tier declares ASSURANCE. A validator
> (`scripts/validate_sep.js` in the reference repo) enforces both layers plus
> a method registry, so tier-conflation (the exact failure mode of PDF
> attestations) is a machine-checkable warning.
>
> Reference records Ex.1–Ex.4 are filled from REAL Stellar testnet transactions
> (hashes inside); every claim re-queries on Horizon.

## Scope / non-goals

- IN scope: record fields, tiers, method registry rules, canonicalization.
- OUT of scope (explicit): proof-byte encoding, prover APIs, cross-chain relay,
  method-registration governance, fork-evidence rules (v0.3+ candidates).

## Review asks (external — the boxes this repo cannot close alone)

1. **Two independent readers**: fill a record for the epoch-0 attestation
   (tx `0619f141…`) and confirm byte-identical canonical JSON.
2. **Method coverage**: is any deployed proving system unrepresentable?
3. **Muxed accounts**: accept the v0.2 plain-`G` scope, or demand v0.3 muxed support now?
4. **Fork evidence**: desired conflict-detection semantics for v0.3?

## Packet contents (all in-repo, CI-green)

- `docs/SEP-ATTESTATION-FORMAT.md` (spec) + `-SCHEMA.json` (machine schema)
- `docs/SEP-ATTESTATION-EXAMPLES.md` (Ex.1–Ex.4, strict-clean under the validator)
- `docs/SEP-METHOD-REGISTRY.md` + `docs/SEP-FAQ.md`
- `scripts/validate_sep.js` + `scripts/validate_sep.test.js` (16 cases)
- This packet + the triaged review checklist + revision log v0.2 entry.
