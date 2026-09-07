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
