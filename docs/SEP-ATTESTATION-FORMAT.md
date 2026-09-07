# SEP-DRAFT: Standardized Treasury Attestation Record (issue #43)

Status: **DRAFT v0.1 — not submitted.** For community review inside this repo
first (see `docs/SEP-REVIEW-CHECKLIST.md`).

## Motivation

Every Stellar issuer attests health differently (PDFs, dashboards, ad-hoc
JSON), so wallets, auditors, and regulators cannot consume attestations
programmatically. This SEP standardizes the RECORD FORMAT — not the proving
system: any backend (ZK or otherwise) can publish a conforming record, with
a `method` field declaring how each claim is evidenced.

## Record (v0.1)

Required fields (see `docs/SEP-ATTESTATION-SCHEMA.json` for the machine
schema, `docs/SEP-ATTESTATION-EXAMPLES.md` for filled records):

| Field | Type | Meaning |
|---|---|---|
| `sep` | string | `"tessera-attestation/0.1"` version tag |
| `contract` | string | Issuing contract (Stellar `C...`) |
| `epoch` | uint | Monotonic attestation epoch |
| `root_hash` | hex64 | Commitments-set commitment |
| `total_commitments` | uint str | Attested total |
| `treasury` | uint str | Declared backing |
| `treasury_holder` | string | Reserve account (`G...`) |
| `reserve_token` | string | Reserve asset (`C...`) |
| `bound_ledger` | uint | Ledger of the binding read |
| `control_proven` | bool | Holder authorized this attestation |
| `non_omission` | `"in-circuit"` \| `"vigilance"` \| `"none"` | Omission-evidence tier |
| `method` | string | e.g. `"groth16-bn254-merkle-sum/1"` |
| `tx` | string | Attestation transaction hash |

## Tier semantics (the honest core)

- `in-circuit`: omission is UNPROVABLE (keys pinned on-chain). Strongest.
- `vigilance`: omission DETECTABLE by the victim (bulletin-board assumption).
- `none`: self-declared. Consumers MUST NOT treat `none` as assurance.

A record claiming `in-circuit` without an on-chain key pin is non-conforming.

## Out of scope (v0.1)

Proof-byte encoding, prover APIs, cross-chain relay, governance of method
registrations. v0.2 candidates listed in `docs/SEP-REVISION-LOG.md`.
