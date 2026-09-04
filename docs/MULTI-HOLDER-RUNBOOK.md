# Multi-holder control runbook (issue #7)

Status: **runbook + scripts. Testnet multi-holder tx itself is NOT-YET.**
Unit tests cover two holders; the testnet multi-asset demo used one signer
across two assets (honest caveat from PRD, retained here).

## Why multi-holder matters

`submit_multi_attestation` requires **every leg holder to authorize**
(`require_auth` per holder = control of ALL reserve accounts) and enforces
`treasury <= sum(live scaled balances)`. With one signer the control proof is
weaker (one key controls both legs). With N distinct signers the proof is:
each reserve account independently authorized this attestation at this ledger.

## Preconditions

- Contract from ADVANCED-STATUS (`CDGNPPPT4...`, or fresh deploy).
- Two funded testnet accounts: `HOLDER_A`, `HOLDER_B` (see
  `scripts/testnet_multi_holder_demo.sh` env).
- Same-unit legs only (FIX 2): `set_reserve_legs` rejects non-1:1 with
  Error #13. Cross-asset at real prices needs Reflector (issue #10, NOT-YET).

## Steps

```bash
export CONTRACT=CDGNPPPT4YSTUTZ4NFNKMWJXUEVHU5CPDR57EI644LBLKUQX2LOLYHTK
export HOLDER_A=GBKY7FXTESEV6ON5FGMKOIB57OFFAXQT2BMBE2KEHYQPRAT4JQASNUJC
export HOLDER_B=<second holder G...>
export TOKEN_A=CCJZEZSWDJTBAVSPCNRWTDPB4DYHC22UW7D6TI65MX4CFTTD32LEHLFD
export TOKEN_B=<second same-unit SAC C...>
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

## Evidence to capture

- `set_reserve_legs` tx hash, `aggregate_reserves()` value, multi submit tx
  hash + ledger, `get_attestation` dump. Append to `contracts/M4-STATUS.md`
  style record (do not overwrite existing single-holder txs).
