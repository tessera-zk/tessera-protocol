# Milestone 4 — Reserves cryptographically bound to a real on-chain balance

**Status: DONE.** The `reserves` figure is no longer a value the prover
self-declares. The Soroban contract now reads the reserve holder's **live token
balance** cross-contract at submit time and refuses to store an attestation
unless the ZK-declared reserves is backed by that real balance. This closes the
"assets side" gap: competitors either simulate proving or self-declare assets;
here the assets figure is a fact about chain state, enforced on-chain.

End to end the contract now enforces:

```
totalLiabilities  <=  reserves  <=  balance(reserve_holder, reserve_token)
      (ZK-proven)          (contract-read, live, cross-contract)
```

Liabilities are proven `<= reserves` inside the SNARK (never revealing any
customer balance); `reserves` is bound on-chain to a real token balance the
prover cannot fake.

## Redeployed contract (supersedes M2)

| Item | Value |
|---|---|
| Network | Stellar **testnet** (Protocol 27) |
| Contract ID | `CAKOITWQ2HEBEWY6A7ZH7N3YY43VJAYFNTJECV333E5B2ZDYOKYU5IB7` |
| Wasm hash | `1972f97c655b710884d995dc36772ee0e7a8e5509131fee3aa5ae0eef39e51d7` |
| Deployer / issuer | `zk-deployer` = `GBZK7Z6DMDBVFOURA76RXRQKPIHXTJFGN6CVRMU3J6ZE55YCZBHG3XG2` |
| Reserve holder | `zk-reserve` = `GBKY7FXTESEV6ON5FGMKOIB57OFFAXQT2BMBE2KEHYQPRAT4JQASNUJC` |
| Reserve token (SAC) | `CCJZEZSWDJTBAVSPCNRWTDPB4DYHC22UW7D6TI65MX4CFTTD32LEHLFD` (USDC test asset, issuer `zk-deployer`) |
| Explorer | https://stellar.expert/explorer/testnet/contract/CAKOITWQ2HEBEWY6A7ZH7N3YY43VJAYFNTJECV333E5B2ZDYOKYU5IB7 |

The reserve holder + token are set **immutably in the constructor**
(`__constructor(reserve_holder, reserve_token)`). There is no setter, so the
binding target cannot be swapped to a friendly balance after deploy.

## Real transactions (all re-queryable via Horizon)

| Action | Tx hash | Ledger | Result |
|---|---|---|---|
| Trustline (reserve trusts USDC) | `2016751722c9d80410479ad26d6f4615dbb9fc66e6c2ee4779f2bc19a56fd961` | — | success |
| Fund reserve 100000 (underfunded) | `f98f8d3f76ee844ea9727cb7cdd962f8c85e4427d6feeac2a88263a36e43e6e5` | — | success |
| Deploy bound contract (constructor) | `a76601211cfced54a935d8777c17f06d7cd15bc8f76dd348a8e64fc17aaf1e7e` | 3383772 | success |
| **Rejection: over-declared reserves** | (no ledger tx — preflight trap) | — | `Error(Contract, #5)` = `ReserveUnbacked` (balance 100000 < declared 189140) |
| Top up reserve +89140 → 189140 | `74cf33577e6bdb29fefa0798fbb925d691c2bf2419dabf8905dc7e11605f6b90` | — | success |
| **Accept: bound attestation** | `e506122203af411ff41ddf7628be9e1731060de2c58770b4a39e81492f5a4e62` | 3383787 | success, epoch `0`, event carries bound reserves `i128:189140` |

Re-query the accept tx:
```bash
curl -s https://horizon-testnet.stellar.org/transactions/e506122203af411ff41ddf7628be9e1731060de2c58770b4a39e81492f5a4e62 \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['hash'],d['successful'],d['ledger'])"
# -> e50612...4e62 True 3383787
```

Stored attestation read back on-chain (`get_attestation`):
```json
{"epoch":0,
 "root_hash":"28d91750661fb24465616eb4ef70f381c7863cd970d17f4da840d102264eeff7",
 "total_liabilities":"...0002cf4c",   // 184140
 "reserves":"...0002e2d4",             // 189140 (ZK-declared)
 "reserve_holder":"GBKY7FXTESEV6ON5FGMKOIB57OFFAXQT2BMBE2KEHYQPRAT4JQASNUJC",
 "reserve_token":"CCJZEZSWDJTBAVSPCNRWTDPB4DYHC22UW7D6TI65MX4CFTTD32LEHLFD",
 "bound_reserves":189140,              // real on-chain balance, contract-read
 "bound_ledger":3383787,
 "timestamp":1782933703}
```
`bound_reserve_info() -> (holder, 189140, 3383787)`, `live_reserve_balance() -> 189140`.

### The rejection is real

Submitting the valid solvency proof while the reserve holder held only 100000
was rejected on-chain. The diagnostic event trail shows the full flow executing
before the trap:

```
fn_call  submit_attestation(proof, [root, 184140, 189140])
fn_call  CCJZEZSW...  balance(GBKY7F...)     # cross-contract read
fn_return balance = 100000
error    Error(Contract, #5)                 # ReserveUnbacked: 189140 > 100000
```

Note the Groth16 pairing check passed (we reached the balance read); the
attestation was blocked purely because the declared reserves was not backed. As
with any contract-error preflight trap on Soroban, this consumes no ledger space
and produces no on-ledger tx hash by design (same mechanism documented for the
tampered-proof case in `M2-STATUS.md`). It is deterministically reproduced by the
unit test `over_declared_reserves_rejected_when_unbacked`.

## Contract changes (`contracts/proof-of-reserves/src/lib.rs`)

| Function | Change |
|---|---|
| `__constructor(reserve_holder, reserve_token)` | **New.** Immutably binds the instance to a reserve holder + token (SAC). |
| `submit_attestation(proof, public_signals) -> u32` | After the Groth16 + `reserves >= totalLiabilities` checks, reads `TokenClient::new(reserve_token).balance(reserve_holder)` and panics `ReserveUnbacked (#5)` if `declared_reserves > on_chain_balance`. Stores the real balance as `bound_reserves` plus `reserve_holder`, `reserve_token`, `bound_ledger`. |
| `reserve_config() -> Option<ReserveConfig>` | **New.** The immutable `{reserve_holder, reserve_token}`. |
| `live_reserve_balance() -> i128` | **New.** Reads the holder's balance right now, cross-contract. |
| `bound_reserve_info() -> Option<(Address, i128, u32)>` | **New.** `(reserve_holder, bound_reserves, bound_ledger)` from the latest attestation. |

New errors: `ReserveUnbacked (#5)`, `ReservesOutOfRange (#6)`, `NotConfigured (#7)`.
`reserves` is compared as a non-negative `i128` via `be32_to_i128` (rejects any
field element that does not fit the token-balance domain).

Tests: `cargo test -p proof-of-reserves` → **9 passed**, including
`over_declared_reserves_rejected_when_unbacked` (reject),
`exactly_backed_reserves_accepted` and
`over_backed_reserves_accepted_and_binds_real_balance` (accept + binds the real,
larger balance). The mock reserve is a real `register_stellar_asset_contract_v2`
SAC minted to a holder — the same `balance()` interface hit on testnet.

## Frontend

`frontend/lib/stellar.ts` points at the new contract, decodes the extra
attestation fields, and adds `live_reserve_balance`. `frontend/app/board/page.tsx`
shows a **"Reserves cryptographically bound to on-chain balance"** badge, the
ZK-declared vs on-chain-bound reserves side by side, the reserve holder + SAC
(linked to stellar.expert), the bound ledger, and the live holder balance read
in the browser. In-browser snarkjs proving is unchanged. `tsc --noEmit` is clean;
a headless click-through of `/board` renders the bound attestation from the live
contract with no console errors.

## Trust model (precise)

**ZK-proven (in the SNARK, no balance revealed):**
- every customer balance is non-negative (blocks negative-balance forgery),
- the Merkle-sum root and total liabilities are computed correctly,
- `totalLiabilities <= reserves`.

**On-chain-bound (enforced by the contract, not trusted from the prover):**
- `reserves <= balance(reserve_holder, reserve_token)`, read live cross-contract
  at the attestation ledger. The holder + token are fixed immutably at deploy.
- So the certified reserves figure is floored by a real token balance the issuer
  actually holds; over-declaring is rejected on-chain.

**NOT-YET (honest gaps):**
- **Multi-wallet / full-treasury binding.** One reserve holder + one token are
  bound. Real reserves span many accounts and assets; aggregating balances across
  a set of holders/tokens (or a signed attestation of external-chain reserves) is
  future work. NOT-YET.
- **Undisclosed liabilities (book omission).** The issuer could hold liabilities
  outside the committed Merkle-sum tree. No proof-of-reserves scheme solves this;
  it needs a proof-of-liabilities attestation (e.g. signed customer claims).
  NOT-YET / documented non-goal.
- **Holder ≠ segregated custody.** Binding proves the holder controls the balance
  at that ledger, not that the funds are unencumbered or customer-segregated.
  NOT-YET.
- **Reserve-holder rotation.** The binding is immutable by design; rotating the
  holder requires a redeploy (or a future governance-gated setter). Intentional
  trade-off favouring non-riggability.
- **Trusted setup.** Groth16 phase-2 is single-contributor, not a production MPC
  ceremony (see `circuits/README.md`). Unchanged from M1.

## Reproduce

```bash
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"
ISSUER=GBZK7Z6DMDBVFOURA76RXRQKPIHXTJFGN6CVRMU3J6ZE55YCZBHG3XG2
ASSET="USDC:$ISSUER"; SAC=CCJZEZSWDJTBAVSPCNRWTDPB4DYHC22UW7D6TI65MX4CFTTD32LEHLFD

# 1. Reserve holder with a real (underfunded) USDC balance
stellar keys generate zk-reserve --network testnet --fund
stellar tx new change-trust --line "$ASSET" --source zk-reserve --network testnet
stellar tx new payment --destination zk-reserve --asset "$ASSET" --amount 100000 \
  --source zk-deployer --network testnet
RES=$(stellar keys address zk-reserve)

# 2. Build + deploy bound to (reserve_holder, reserve_token)
cd contracts && stellar contract build
stellar contract deploy --wasm target/wasm32v1-none/release/proof_of_reserves.wasm \
  --source zk-deployer --network testnet -- --reserve_holder $RES --reserve_token $SAC

# 3. Rejection: submit the real proof while underfunded -> ReserveUnbacked (#5)
# 4. Top up to 189140, resubmit -> accepted, bound_reserves=189140
stellar tx new payment --destination zk-reserve --asset "$ASSET" --amount 89140 \
  --source zk-deployer --network testnet
# submit_attestation args from ../artifacts/onchain-args.json (solvency)
```
