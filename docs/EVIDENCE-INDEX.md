# Claim-to-evidence index (issue #44)

| Claim | Evidence | How to check |
|---|---|---|
| SNARK verified on-chain (Protocol 27) | Bound attestation tx `e506122203af411ff41ddf7628be9e1731060de2c58770b4a39e81492f5a4e62` | Stellar Expert testnet link |
| Negative commitments unprovable | `Num2Bits(64)` per leaf; unified negative control `docs/UNIFIED-NEGATIVE-CONTROL.md` (real EdDSA assert failure) | Re-run `scripts/verify_unified_setup.sh` + witness control |
| Reserves bound to live balance | Cross-contract `balance()` read; over-declare rejected (`ReserveUnbacked` #5); bound tx above | `contracts/M4-STATUS.md` |
| Holder control proven | `require_auth` per attestation; `submit_without_reserve_holder_auth_fails` test | `cargo test -p tessera-ledger` (35 green) |
| Registered-member omission rejected | `Error #10` pin; honest + omission testnet demo (`cec46e6cfdba18d6bfefdb61633d017aa6a0be66ff38e90cae231f87ae6ee7ef`) | `ADVANCED-STATUS.md` FIX 1 |
| Risk limits proven in ZK | `risk_solvency` (per-LEAF scope); tx `f9dac6eab954988fc0a325753d0e49832ea570790339a4804aecaba1898541ff` | `contracts/M4-STATUS.md`-era risk demo record |
| Multi-asset same-unit backing | 1:1 enforcement + aggregate; tx `f8631c7019f91980fc4411868f7832bb815bcf7bff5583f69074a39f0e85ac4a` (aggregate 189140) | `ADVANCED-STATUS.md` FIX 2 |
| Member inclusion returns true | Inclusion tx `c83185c61ef933e5f9affc4ea5b169079953d8ba1c6c6f71afd219d66958ece6` | Stellar Expert testnet link |
| Scale to 256 accounts | Depth-8: 337,079 constraints, 0.98s verify, 806 B proof | `BENCHMARKS.md` |
| 35 contract tests green | `docs/CONTRACT-HARDENING-RECORD.md` (real output) | `cargo test -p tessera-ledger` |
| 43 contract tests green (35 + 8 unified entrypoint) | `submit_unified_attestation` suite (honest/omission/stale/replay/unbacked/arity) | `cargo test -p tessera-ledger` |
| Two-holder control on live legs (fresh contract) | `set_reserve_legs` tx `739a7f9f09f62069455cb14d5d74d6e920a3fe42f94627d05f05f617d160e7a0` (L4602999) + `submit_multi_attestation` tx `168785eb1a18617b6c72ab46a9b565a81458656734e88b33a1c89019b6decdca` (L4603136 SUCCESS, aggregate 200000, 2 auth entries, epoch 1) — single-operator caveat disclosed | `evidence/multi-2026-09-10.md` |
| Unified setup real (2^16) | `docs/UNIFIED-SETUP-LOG.md` (hashes) + `vk_unified_solvency.json` | `scripts/verify_unified_setup.sh` |
| Priced-aggregate math correct | `docs/ORACLE-TRIAL-RESULTS.md` (9/9 tests) | `node --test scripts/oracle_math.test.js` |
| Keyed-risk vectors behave | `docs/KEYED-RISK-VECTOR-RESULTS.md` (4/4) | `bash scripts/run_keyed_risk_vectors.sh` |
| Single-contributor setup caveat | Disclosed in README, circuits README, ADVANCED-STATUS, SECURITY, setup docs | grep `single-contributor` |
| Depth-10, ceremony, cross-asset, per-member, membership | NOT-YET with per-track remainders | Handoff §9 / `docs/SETUP-*.md`, spike docs |

No other health/backing claims are made. Marketing copy MUST NOT exceed
this table.
