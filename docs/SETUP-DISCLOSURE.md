# Setup disclosure (short form, issue #9)

Copy this block into any release/announcement touching proofs:

> Proofs are Groth16 on BN254. Phase-1 is the public Hermez Powers of Tau;
> phase-2 is a **single-contributor setup (not a ceremony)**. A malicious
> setup could forge proofs, so "unprovable" claims hold only under an honest
> setup. Production needs the multi-party ceremony in
> `docs/TRUSTED-SETUP-CEREMONY.md`. Testnet only, unaudited.

Key locations carrying the same caveat: `README.md`, `circuits/README.md`,
`ADVANCED-STATUS.md`, `SECURITY.md`, `docs/SETUP-REPRODUCIBILITY.md`.
