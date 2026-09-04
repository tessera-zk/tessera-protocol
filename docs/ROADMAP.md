# Roadmap — Tessera ZK (consolidated)

Authoritative detail lives in [`PRD.md`](../PRD.md) (product scope + NOT-YET
list) and [`ADVANCED-STATUS.md`](../ADVANCED-STATUS.md) (upgrades + audit
fixes). This file tracks **where each track stands and what remains**.

## Shipped (testnet-verified, Protocol 27)

- Base health circuit + on-chain Groth16 verification (`solvency`,
  `inclusion`), 20,511 constraints, depth 4.
- Reserves bound to live on-chain balance + holder control (`require_auth`).
- In-circuit non-omission (FIX 1): member-self-registered keys pinned
  position-by-position, Error #10 on omission.
- Same-unit multi-holder aggregation (FIX 2): non-1:1 rejected, Error #13.
- Risk limits, per-LEAF scope (FIX 3): concentration cap + collateral floor.
- Freshness monotonicity (FIX 4, Error #14), canonical-range checks (M3, #16),
  explicit overflow (#15).
- Scale verified to depth 8 (256 accounts, 806-byte proof, 0.98s verify).
- Contract suite: 26 tests green, also in CI.

## Design / prototype tracks (NOT production — see per-track remainder)

| Track | Shipped (issue/PR) | Remains NOT-YET |
|---|---|---|
| Unified health+risk+non-omission circuit | Spec + skeleton + vectors (#5/#15) | Phase-2 setup, vkey, `submit_unified_attestation`, audit, testnet demo |
| Embeddable badge + JSON status | SVG + JSON v1 + docs (#6/#16) | Issuer production deployment, freshness SLA |
| Multi-holder control demo | Runbook + scripts + helpers (#7/#17) | Two-signer testnet tx |
| Depth-10 (1,024 accounts) | Mirror script + harness + plan (#8/#18) | Provisioned run (2.3GB ptau, ~16GB RAM) |
| Trusted-setup ceremony | Plan + verify scripts + record (#9/#19) | Multi-party ceremony, transcript, redeploy |
| Reflector cross-asset reserves | Spike + off-build trait + design (#10/#20) | Oracle wiring, staleness tests, audit, new entrypoint |
| Per-member concentration | Spec + prototype + vectors (#11/#21) | Audit, Sybil/registration policy, deploy |
| Dynamic membership | Lifecycle + API pin + helpers (#12/#22) | `unregister`/`version` contract changes, depth migration |

## Platform (done)

- CI: circuits / contract / frontend / docs workflows, all green (#13/#23,
  repaired #27/#28). Depth-10 excluded from CI by rule.
- Repo hygiene: `CONTRIBUTING.md`, `SECURITY.md`, CoC, issue/PR templates,
  secret-hygiene gates (#14/#24, #25/#26, #29/#30).
- Org: `tessera-zk`, repo transferred in, community standards 9/9.
- Frontend hardening: typed prover-error map, hygiene checklist (#14/#24).

## Suggested next order (when resuming)

1. Two-signer multi-holder testnet tx (#7 remainder — cheapest real tx).
2. Unified circuit phase-2 + local prove (needs 2^16 ptau, moderate RAM).
3. Keyed-risk audit pass + Sybil policy decision (#11 remainder).
4. Reflector trial in a scratch crate (off-build, per spike doc).
5. Ceremony planning when a production deployment is scheduled.
