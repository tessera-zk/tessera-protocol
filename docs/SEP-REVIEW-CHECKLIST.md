# SEP review checklist (issue #43)

Complete every box before submitting this SEP anywhere outside the repo.

- [ ] Schema validates both examples (re-run the checker in PR #53 notes).
- [ ] No field promises what the tier system disclaims (re-read tier section).
- [ ] `method` registry rules decided: free-form string (v0.1) vs registry (v0.2)?
- [ ] Privacy review: record contains NO member-level data (root only) — confirm.
- [ ] Two independent readers fill a record for the epoch-0 attestation and
      produce byte-identical JSON (canonicalization check).
- [ ] Stellar-key pattern strictness agreed: `^C[A-Z2-7]{55}$` rejects
      malformed addresses — confirm no valid address form is excluded.
- [ ] v0.2 candidate list triaged (revision log) — nothing silently dropped.
