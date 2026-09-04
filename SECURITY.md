# Security Policy

## Supported

Tessera is unaudited research software on Stellar **testnet only**. Do not use
with real value.

## Trust assumptions (disclosed)

- Groth16 phase-2 is **single-contributor** (phase-1 is the public Hermez
  ptau). A malicious setup could forge proofs. Production needs the MPC
  ceremony in `docs/TRUSTED-SETUP-CEREMONY.md`. This caveat applies to every
  "cannot forge / cannot omit" claim.
- Reserve binding proves **control** (`require_auth`), not segregated /
  unencumbered custody.
- Book honesty: unregistered omission is out of scope (Vitalik's caveat);
  registered-member omission is pinned on-chain (FIX 1, Error #10).
- Same-unit reserves only (FIX 2, Error #13 on non-1:1). No oracle prices yet.

## Reporting

Open a GitHub issue for non-sensitive bugs. For sensitive ZK-soundness holes,
open a minimal issue ("possible soundness issue, contact requested") without
proof-of-exploit details; a maintainer will arrange a private channel.
