# Error-code registry (issue #40)

Stable contract — frontend maps, runbooks, and the audit log key off these
numbers. Pinned by `hardening_tests::adjudicated_error_codes_are_stable` and
`error_discriminants_are_unique`. Renumbering requires coordinated changes in
`frontend/lib/errors.ts`, `docs/PROVER-ERRORS.md`, and this file.

| Code | Name | Meaning |
|---|---|---|
| 1 | InvalidSolvencyProof | Groth16 verify failed |
| 2 | MalformedPublicInputs | Wrong public-signal arity |
| 3 | Insolvent | reserves < total (defense in depth) |
| 4 | NoAttestation | Inclusion queried before any attestation |
| 5 | ReserveUnbacked | Declared treasury > live balance |
| 6 | ReservesOutOfRange | Reserves outside i128 domain |
| 7 | NotConfigured | Constructor never ran |
| 8 | BadSignedLeaf | Signed leaf balance disagrees with domain |
| 9 | EmptyRegistry | Empty signed-leaf set |
| 10 | RegisteredSetMismatch | Proof keys ≠ registered order (FIX 1) |
| 11 | RegisteredSetNotSet | Incomplete key registration |
| 12 | NoReserveLegs | Multi path without legs |
| 13 | BadReserveLeg | Non-1:1 scale (FIX 2) |
| 14 | StaleEpoch | Epoch not increasing (FIX 4) |
| 15 | ReserveOverflow | Aggregate overflow, explicit (FIX 5) |
| 16 | NonCanonicalSignal | Signal ≥ r (M3) |
| 17 | RootAlreadyAttested | Root replay across paths |
| 18 | RegisteredSetFull | 5th registration on depth-2 demo |
| 19 | CustomerAlreadyRegistered | Double registration |
| 20 | WeakAttestationDowngrade | Weaker path overwriting signed Latest |
| 21 | RiskPolicyTooWeak | Risk bounds below contract policy |
| 22 | BadReserveToken | Leg token ≠ bound token |
| 23 | StalePrice | Oracle quote older than staleness bound (#64) |
| 24 | BadPrice | Oracle quote non-positive, no fallback (#64) |
| 25 | MissingPrice | No quote for pinned feed, no default (#64) |
| 26 | UnknownPriceFeed | Leg feed not pinned at config time (#64) |
| 27 | OracleNotConfigured | Priced path before set_oracle_config (#64) |
