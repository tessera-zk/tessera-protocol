# Oracle spike — off-build stub (issue #10)

This directory is **not part of the Soroban build** (no `Cargo.toml` member,
not `mod`'d into `lib.rs`). It is a design stub so reviewers can discuss the
Reflector integration without touching consensus code.

- `oracle_trait.rs` — proposed trait + staleness/decimal rules.
- `README.md` (this file) — build exclusion notice.

To trial it: copy the trait into a scratch crate depending on
`soroban-sdk`, implement against a Reflector mock, and report back in
`docs/CROSS-ASSET-DESIGN.md`. Do NOT wire prices into `lib.rs` without an
audit + the staleness tests in the design doc.
