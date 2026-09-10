# Multi-holder control runbook (issue #7; FIRST LIVE RUN #59, 2026-09-10)

Status: **LIVE on the fresh Tessera contract** — two-signer
`submit_multi_attestation` tx `168785eb…` (ledger 4603136, SUCCESS), evidence
`evidence/multi-2026-09-10.md`. Unit tests cover two holders; the legacy
single-signer multi-asset demo caveat (PRD) is superseded for the multi path
(single operator, two distinct signers — disclosed in the evidence file).

## Why multi-holder matters

`submit_multi_attestation` requires **every leg holder to authorize**
(`require_auth` per holder = control of ALL reserve accounts) and enforces
`treasury <= sum(live scaled balances)`. With one signer the control proof is
weaker (one key controls both legs). With N distinct signers the proof is:
each reserve account independently authorized this attestation at this ledger.

## Preconditions

- Fresh Tessera contract `CDSAQVJCHBDQ6SGXYHXBIAWPN4BM4BAR6FE3HMBFO6WOTKBGQ7B2MJWZ`
  (the `CDGNPPPT4...` ADVANCED-STATUS deployment is superseded history — never
  reuse it; live legs from #59 are already configured on the fresh instance).
- Two funded testnet accounts: `HOLDER_A`, `HOLDER_B` (see
  `scripts/testnet_multi_holder_demo.sh` env; #59 used `tessera-holder-a/b`).
- Same-unit legs only (FIX 2): `set_reserve_legs` rejects non-1:1 with
  Error #13. Cross-asset at real prices needs the priced path (#64, mock-only).

## Steps

```bash
export CONTRACT=CDSAQVJCHBDQ6SGXYHXBIAWPN4BM4BAR6FE3HMBFO6WOTKBGQ7B2MJWZ
export HOLDER_A=GB24OU652SNE7LEDDOFSSWU2BT3C46CC7HG4TLZDRN7TZJZU5GRQVMNZ
export HOLDER_B=GC2XQDHWG6MG4FCIILSX34LGN666FFZUESINQDUGHUESSVDKMHKG7HDX
export TOKEN_A=CDVAJVBYDHXI535W3ZA43XN7L2IL3XK2C5WQYCDJHDHUTW4NTGZVC2VS
export TOKEN_B=<same-unit SAC C...>
bash scripts/testnet_multi_holder_demo.sh
```

1. `set_reserve_legs` with two 1:1 legs (signed by deployer/admin).
2. `aggregate_reserves()` read — expect `bal(A) + bal(B)`.
3. `submit_multi_attestation` with base health proof (reserves <= aggregate),
   authorized by BOTH holders (two `--source` / auth entries).
4. `get_attestation` shows multi root; event `attest/multi` with `leg_count 2`.

## Failure modes

- Non-1:1 scale → Error #13 (`BadReserveLeg`). By design (FIX 2).
- Missing holder auth → `require_auth` panic. Add the absent signer's auth entry.
- Over-declared treasury → Error #15 path / `ReserveUnbacked` family; lower
  declared reserves to <= aggregate.
- CLI vec-of-struct args: pass via `--<arg>-file-path` with i128 values as
  JSON STRINGS (`"scale_num":"1"`); bare numbers are rejected (hit 2026-09-10).
- `--sign-with-key` is single-use (CLI 26.1.0): one key via `--source`, the
  second via the recipe below — never two `--sign-with-key` flags.

## Working two-signer recipe (executed 2026-09-10, #59)

`stellar contract invoke --send=yes` cannot carry two Soroban auth signatures,
and `tx sign` chaining appends ENVELOPE signatures only (A+B → `TxBadAuthExtra`,
B-only → `TxBadAuth`). The working path signs each auth ENTRY with its address
key (`scripts/two_signer_submit.js` + `scripts/slip10.js`):

```bash
# 1. build unsigned (no auths) — proof hex via scripts/proof_to_cli.js
stellar contract invoke --id $CONTRACT --source $HOLDER_A --network testnet \
  --build-only -- submit_multi_attestation \
  --proof "$PROOF_HEX" --public_signals-file-path /tmp/multi_pub.json \
  > /tmp/multi_unsigned.xdr
# 2. simulate + assemble + per-entry authorize + source envelope sign + send
UNSIGNED_XDR=/tmp/multi_unsigned.xdr \
SIGNERS=$HOLDER_A_IDENTITY,$HOLDER_B_IDENTITY \
  node scripts/two_signer_submit.js   # prints TX_HASH + LEDGER
```

Result: `168785eb…` (ledger 4603136). Auth entry 0 = source-account
credentials (holder A, covered by envelope); entry 1 = address credentials
(holder B, entry-level signature). Full record: `evidence/multi-2026-09-10.md`.

## Evidence to capture

- `set_reserve_legs` tx hash, `aggregate_reserves()` value, multi submit tx
  hash + ledger, `get_attestation` dump. Append to `contracts/M4-STATUS.md`
  style record (do not overwrite existing single-holder txs).
