# SEP examples (issue #43) — filled v0.1 records from REAL testnet data

## Example 1: canonical epoch-0 attestation (fresh Tessera deployment)

Public values from the canonical attestation (see handoff §2):

```json
{
  "sep": "tessera-attestation/0.1",
  "contract": "CDSAQVJCHBDQ6SGXYHXBIAWPN4BM4BAR6FE3HMBFO6WOTKBGQ7B2MJWZ",
  "epoch": 0,
  "root_hash": "28d91750661fb24465616eb4ef70f381c7863cd970d17f4da840d102264eeff7",
  "total_commitments": "184140",
  "treasury": "189140",
  "treasury_holder": "GDYNFRF3FHYBX42UHYCWGFJ2MFXHZJIXBLII7TQU5YOM6ICTKZPOMKCP",
  "reserve_token": "CDVAJVBYDHXI535W3ZA43XN7L2IL3XK2C5WQYCDJHDHUTW4NTGZVC2VS",
  "bound_ledger": 4490585,
  "control_proven": true,
  "non_omission": "none",
  "method": "groth16-bn254-merkle-sum/1",
  "tx": "0619f141069cd6898c99f44a50b06e8e9447df6f63c223f26c0128c7e4b78782"
}
```

Note `non_omission: "none"` — the epoch-0 base attestation carries no omission
evidence. A consumer MUST NOT read more into it. A signed attestation over
the same book would set `"in-circuit"`.

## Example 2: minimal self-declared record (tier `none`)

```json
{
  "sep": "tessera-attestation/0.1",
  "contract": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "epoch": 7,
  "root_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "total_commitments": "1000",
  "treasury": "1000",
  "treasury_holder": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "reserve_token": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "bound_ledger": 0,
  "control_proven": false,
  "non_omission": "none",
  "method": "self-declared/1",
  "tx": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

Shape-valid per the schema, assurance-free by the tier. The schema validates
STRUCTURE; the tier declares ASSURANCE. Conflating the two is the exact
failure mode this SEP exists to prevent.

## Example 3: signed epoch-2 attestation, tier `in-circuit` (fresh contract, live)

From `evidence/advanced-2026-09-10.md`: 4 self-registered keys, honest
`submit_signed_attestation` tx `66cbf46f…` (ledger 4603225). The `in-circuit`
tier is CORRECT here — the proof's signer keys are pinned on-chain
(`RegisteredSetMismatch` would have fired otherwise). Method
`groth16-bn254-signed-merkle-sum/1` is the only registered method evidencing
this tier (see `docs/SEP-METHOD-REGISTRY.md`).

```json
{
  "sep": "tessera-attestation/0.1",
  "contract": "CDSAQVJCHBDQ6SGXYHXBIAWPN4BM4BAR6FE3HMBFO6WOTKBGQ7B2MJWZ",
  "epoch": 2,
  "root_hash": "08ac11ac6db6f93236032d8800642f213fd53f0849d5624de16f6b73531f1012",
  "total_commitments": "28000",
  "treasury": "30000",
  "treasury_holder": "GDYNFRF3FHYBX42UHYCWGFJ2MFXHZJIXBLII7TQU5YOM6ICTKZPOMKCP",
  "reserve_token": "CDVAJVBYDHXI535W3ZA43XN7L2IL3XK2C5WQYCDJHDHUTW4NTGZVC2VS",
  "bound_ledger": 4603225,
  "control_proven": true,
  "non_omission": "in-circuit",
  "method": "groth16-bn254-signed-merkle-sum/1",
  "tx": "66cbf46f69efed8e484856fbe73b9c6092a567d23a3728b9c4cb7a17a39cdcbe"
}
```

## Example 4: two-holder multi attestation, tier `none` (fresh contract, live)

From `evidence/multi-2026-09-10.md`: `submit_multi_attestation` tx
`168785eb…` (ledger 4603136, aggregate 200000, two auth entries). Tier `none`
is CORRECT here — the multi path verifies the BASE health proof (same circuit
as Example 1, hence the same `method`), and carries no omission evidence.
The two-signer control fact lives in the tx envelope, not in this record:
a consumer MUST NOT read omission assurance into it.

```json
{
  "sep": "tessera-attestation/0.1",
  "contract": "CDSAQVJCHBDQ6SGXYHXBIAWPN4BM4BAR6FE3HMBFO6WOTKBGQ7B2MJWZ",
  "epoch": 1,
  "root_hash": "06388cea9cd1948c49a634a17119232c03f2d59331b1ec27da910a5a303002e8",
  "total_commitments": "184140",
  "treasury": "189140",
  "treasury_holder": "GB24OU652SNE7LEDDOFSSWU2BT3C46CC7HG4TLZDRN7TZJZU5GRQVMNZ",
  "reserve_token": "CDVAJVBYDHXI535W3ZA43XN7L2IL3XK2C5WQYCDJHDHUTW4NTGZVC2VS",
  "bound_ledger": 4603136,
  "control_proven": true,
  "non_omission": "none",
  "method": "groth16-bn254-merkle-sum/1",
  "tx": "168785eb1a18617b6c72ab46a9b565a81458656734e88b33a1c89019b6decdca"
}
```
