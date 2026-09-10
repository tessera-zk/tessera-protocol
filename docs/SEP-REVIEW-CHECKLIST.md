# SEP review checklist (issue #43; triaged #70 — v0.2)

- [x] Schema validates both examples (re-run the checker in PR #53 notes).
      SUPERSEDED: `node scripts/validate_sep.js --doc` validates ALL FOUR
      examples in CI (docs workflow `sep` job). Manual re-runs no longer needed.
- [x] No field promises what the tier system disclaims (re-read tier section).
      Enforced mechanically: `TIER_METHOD_MISMATCH` warns on any record whose
      tier outruns its method (16-case corpus pins it).
- [x] `method` registry rules decided: free-form string (v0.1) vs registry (v0.2)?
      DECIDED: registry (`docs/SEP-METHOD-REGISTRY.md`), unknown methods warn.
- [x] Privacy review: record contains NO member-level data (root only) — confirm.
      CONFIRMED: schema required/optional fields enumerated — root hash is the
      only commitments-set field; no balance/key/nonce/signature field exists.
      Corpus asserts extra member-shaped fields are unnecessary (none defined).
- [ ] Two independent readers fill a record for the epoch-0 attestation and
      produce byte-identical JSON (canonicalization check).
      HALF-DONE (mechanical): `canonicalize` + test proves two CONSTRUCTIONS
      agree byte-for-byte. EXTERNAL REMAINDER: two HUMAN readers — listed as
      review ask #1 in the submission packet.
- [x] Stellar-key pattern strictness agreed: `^C[A-Z2-7]{55}$` rejects
      malformed addresses — confirm no valid address form is excluded.
      TRIAGED: muxed `M...` accounts ARE excluded — INTENTIONAL for v0.2
      (plain accounts only), recorded as the v0.3 candidate in the revision
      log. Corpus pins the rejection so it cannot slip in silently.
- [x] v0.2 candidate list triaged (revision log) — nothing silently dropped.
      Done: registry/canonicalization/live-records LANDED in v0.2 (above);
      fork-evidence/multi-chain/proof-bytes/governance DEFERRED to v0.3+ with
      rationale (need community input) in the revision log.
