# Multi-holder evidence template (issue #35)

Copy to `evidence/multi-<date>.md` and fill during the funded run. Every field
is required before any control claim is published.

```markdown
# Multi-holder evidence — <YYYY-MM-DD>

- Contract: `<id>`
- Holder A: `<G...>` (key held by: <name>, machine: <desc>)
- Holder B: `<G...>` (key held by: <name>, machine: <desc>)
- Distinct operators confirmed: yes / NO (if NO, stop — single-signer caveat)
- Legs file hash (sha256 of legs.json): `<hex>`
- Declared treasury (recorded BEFORE submit): `<n>`
- Previewed aggregate: `<n>` (treasury <= aggregate confirmed: yes)
- set_reserve_legs tx: `<hash>` (ledger: <n>)
- submit_multi_attestation tx: `<hash>` (ledger: <n>)
- attest/multi leg_count: <n> (must be 2)
- get_attestation dump: <paste>
- Checklist output: <paste PASS lines>
- Single-signer caveat applies: yes / no
```
