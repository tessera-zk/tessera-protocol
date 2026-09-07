# SEP FAQ (issue #43, draft)

## Does a conforming record mean the issuer is solvent?

No. It means the issuer published a MACHINE-READABLE claim with a declared
assurance tier. `none`-tier records are structured self-declarations. Check
`non_omission`, `control_proven`, and `method` — then verify the `tx`
yourself.

## Why three non-omission tiers instead of requiring in-circuit?

Because most issuers cannot do in-circuit non-omission today. A standard
that only blesses the strongest tier gets ignored; a standard with honest
tiers gets adopted and lets consumers price the difference.

## Can a non-ZK issuer conform?

Yes — with `method: "self-declared/1"` (or their audit method),
`non_omission: "none"`, `control_proven: false`. Conformance is about FORMAT,
not strength. Misrepresenting the tier is non-conformance.

## Why are amounts strings, not numbers?

Commitment totals can exceed JSON-safe integers and fixed-point conventions
vary by asset. Strings preserve exactness; consumers parse with BigInt.

## What stops an issuer from publishing two conflicting records?

Nothing in v0.1 — same as today. `epoch` monotonicity + `bound_ledger` let
consumers detect forks. Fork-evidence rules are a v0.2 candidate.

## Is `tx` required to be on Stellar?

v0.1 assumes Stellar (`C...`/`G...` patterns). Multi-chain encodings are a
v0.2 candidate (see revision log).
