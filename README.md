# Tessera — Private Treasury Attestations on Stellar

A Circom + Groth16 confidential attestation system whose SNARK is verified **on-chain**
by a Soroban contract on Stellar (Protocol 27, native BN254 host functions). An
issuer publishes a Merkle-sum commitment of all member commitments plus a
Groth16 proof; the contract verifies it on-chain and stores the attested root
only if the proof checks. The proof certifies, in zero knowledge, that:

1. every member commitment is non-negative (blocks hidden negative forgery),
2. the Merkle-sum root and total commitments are computed correctly, and
3. `totalCommitments <= treasury` (health),

without revealing any individual commitment. Members separately run a Merkle-sum
**inclusion proof** to confirm their commitment was counted in the certified total.

Crucially, the `treasury` figure is **not self-declared**: the contract reads the
treasury holder's live token balance cross-contract at submit time and rejects any
attestation whose declared treasury exceeds it. So the chain enforces
`totalCommitments <= treasury <= real on-chain balance` end to end.

## Highlights (all verified on Stellar testnet, Protocol 27)

Current fixed contract (all advanced upgrades plus adversarial-audit fixes):
[`CBTN433JB2LSFHPLGEZTLEW43IKKXPKN5AYHJVMLKO4NN6EQNBVDRJP4`](https://stellar.expert/explorer/testnet/contract/CBTN433JB2LSFHPLGEZTLEW43IKKXPKN5AYHJVMLKO4NN6EQNBVDRJP4)
· `25/25` contract tests pass.

- **IN-CIRCUIT non-omission (FIX 1): VERIFIED.** Each member's Baby-JubJub
  EdDSA signature is verified **inside the SNARK** and each leaf's signer key is
  a public input pinned against a MEMBER-self-registered ordered key list. The
  issuer no longer authors the registered-set commitment. Honest tx:
  `submit_signed_attestation` `cec46e6c…`; omission with a filler key at slot C
  is rejected on-chain during simulation with `Error #10`.
- **Multi-holder, same-unit reserves (FIX 2): VERIFIED.** Reserve legs aggregate
  live 1:1 balances only. Non-1:1 issuer-set scale is rejected with `Error #13`.
  Accepted same-unit `submit_multi_attestation` tx `f8631c70…` stores aggregate
  reserves `189140`.
- **Concentration / risk limits (FIX 3): VERIFIED with honest scope.**
  `risk_solvency.circom` proves a per-LEAF concentration cap and reserves ≥ 105%
  of commitments. A leaf-concentrated or undercollateralized book is unprovable.
  Per-member concentration needs keyed leaves merged into the risk circuit and
  is NOT-YET.

- **Reserves bound to a real on-chain balance (M4): VERIFIED.** `submit_attestation`
  reads `balance(reserve_holder, token)` cross-contract and rejects `ReserveUnbacked #5`
  if declared reserves exceeds it. Bound attestation `e5061222…` (`bound_reserves=189140`);
  inclusion proof `c83185c6…` → `true`.
- **Proof-of-assets CONTROL (UPGRADE 2): VERIFIED.** `submit_attestation` now requires
  `reserve_holder.require_auth()` (per-invocation ed25519 challenge), so the bound
  reserve is a **controlled** account, not just any holder. Auth-gate proven by test
  `submit_without_reserve_holder_auth_fails`.
- **Non-omission signed leaves (UPGRADE 1): VERIFIED.** Members sign their own leaves;
  `register_signed_leaves` re-verifies every ed25519 signature on-chain (`d8700e0f…`,
  4 sigs). An omitted member proves omission on-chain: `verify_signed_claim` succeeds while
  the leaf is absent (`a1599256…`, epoch-1 omitted root `37b08606…`). A forged leaf is
  rejected on-chain. Honest caveat: omission is detectable by the victim, **not
  unilaterally preventable** (bulletin-board assumption).
- **Scale: VERIFIED to 256 accounts.** Depth 8 = 256 accounts: constant ~806-byte proof,
  **0.98 s** on-chain verify. Proof size + verify stay constant as the book grows. Depth
  10 (1,024 accounts) is **NOT-YET**: blocked on the 2.3 GB `2^21` ptau provisioning,
  not the circuit. See `BENCHMARKS.md`.

Every claim above is backed by a real tx hash or a passing test (`UPGRADES-STATUS.md`,
`BENCHMARKS.md`); anything not yet implemented is tagged NOT-YET.

## What runs today (verified)

### Milestone 1: circuits + real proofs (BN254)
- `circuits/solvency.circom` (20,511 constraints) and `circuits/inclusion.circom`.
- Real snarkjs Groth16 artifacts (verification keys, proofs, public signals) for
  both circuits. Negative-commitment and underfunded books are rejected at witness
  generation. See `circuits/README.md` and `logs/prove_run.log`
  (`SUMMARY: pass=4 fail=0`).

### Milestone 2: on-chain verification (Soroban, testnet)
- `contracts/tessera-ledger/`: a Soroban contract that verifies our real
  BN254 Groth16 proofs on-chain via Protocol 27 host functions:
  - `submit_attestation(proof, public_signals)`: verifies the solvency proof;
    stores `{rootHash, totalCommitments, treasury, timestamp}` only if valid,
    panics otherwise.
  - `verify_inclusion(proof, public_signals)`: checks a member's inclusion proof
    against the stored healthy root; returns `true`/`false`.
  - `get_attestation()` / `epoch_count()`: read the latest attestation.
- `contracts/scripts/convert.js`: snarkjs → Soroban byte-layout converter.
- `contracts/tessera-ledger/src/test.rs`: 6 tests driven by the **real**
  proof: valid proof verifies on-chain, tampered proof is rejected, inclusion
  passes against the stored root and fails against a wrong root.

Original M2 deployment (self-declared reserves) contract ID
`CB7TTXIUAFIUSICXTAZRB6MNVON6Y3V24RRYNEGF5NGDAOX75L3UBDKD`; full tx hashes,
byte-encoding notes and reproduction commands in
[`contracts/M2-STATUS.md`](contracts/M2-STATUS.md).

### Milestone 4: reserves bound to a real on-chain balance (the differentiator)
- `submit_attestation` now reads `balance(reserve_holder, reserve_token)`
  cross-contract (SEP-41 SAC) and panics `ReserveUnbacked` if the ZK-declared
  reserves exceeds the real balance. The holder + token are set immutably in the
  constructor, so the binding target cannot be rigged post-deploy.
- New reads: `reserve_config()`, `live_reserve_balance()`, `bound_reserve_info()`.
  The stored attestation carries `bound_reserves` (the real balance),
  `reserve_holder`, `reserve_token`, `bound_ledger`.
- 9 unit tests (real proof fixture + a real `register_stellar_asset_contract_v2`
  SAC): over-declared reserves rejected, exactly/over-backed accepted.

**Redeployed on Stellar testnet.** Contract ID
`CAKOITWQ2HEBEWY6A7ZH7N3YY43VJAYFNTJECV333E5B2ZDYOKYU5IB7`, bound to reserve
holder `GBKY7FXTESEV6ON5FGMKOIB57OFFAXQT2BMBE2KEHYQPRAT4JQASNUJC` holding the USDC
test SAC `CCJZEZSWDJTBAVSPCNRWTDPB4DYHC22UW7D6TI65MX4CFTTD32LEHLFD`. Real bound
attestation tx `e506122203af411ff41ddf7628be9e1731060de2c58770b4a39e81492f5a4e62`
(ledger 3383787, `bound_reserves=189140`); the over-declared attempt was rejected
on-chain (`Error(Contract, #5)`). Full details, all tx hashes and the precise
trust model: [`contracts/M4-STATUS.md`](contracts/M4-STATUS.md).

### Upgrades: proof-of-liabilities non-omission + proof-of-assets control (the conceptual wins)
- **Non-omission (UPGRADE 1).** Each member signs their own liability leaf with
  their ed25519 (Stellar) key; the contract re-verifies those signatures on-chain
  (`register_signed_leaves` / `verify_signed_claim`) and publishes the signed-leaf
  registry. An issuer that omits an account is caught: the omitted member's signed
  claim verifies on-chain while their leaf is provably absent from the attested
  root. The issuer cannot fabricate or downgrade a leaf (a forged signature is
  rejected on-chain). Honest caveat: omission is *detectable by the victim*, not
  unilaterally preventable: members must keep their signed claim and check each
  epoch (bulletin-board assumption).
- **Assets control (UPGRADE 2).** `submit_attestation` now requires the reserve
  holder to authorize it (`require_auth`, a per-invocation ed25519 challenge), so
  the bound reserve is a **controlled** account, not just any address holding
  tokens. An address the issuer doesn't control cannot back an attestation.

**Redeployed (supersedes M4).** Contract ID
`CD547PEN53FRUV6VQMSAHMETVCXHXCHLENUBKKMQD7PI36F3W72IXRGI` (wasm hash
`8c89ef728c2db58c499563b8ef5c7c13843215624e63bcbe80afa717b22dd4b2`). 14/14 contract
tests pass; both upgrades demonstrated on testnet with real tx hashes (honest
signed-leaf attestation, member inclusion, forged-leaf rejection, provable omission,
proof-of-control). Full design, every tx hash, the sharpened trust model and honest
blockers: [`UPGRADES-STATUS.md`](UPGRADES-STATUS.md).

## Layout

```
circuits/        solvency + inclusion Circom circuits (BN254) and README
circuit-keys/    real snarkjs verification keys + proving keys
build/proofs/    real proofs + public signals (committed for the demo)
contracts/
  tessera-ledger/   Soroban contract (Groth16 core + attestation logic)
  scripts/convert.js   snarkjs -> Soroban byte-layout converter
  artifacts/           on-chain call args (hex) generated by the converter
  M2-STATUS.md         deployment record: contract ID, tx hashes, encoding notes
  M4-STATUS.md         reserve-binding record: bound contract ID, tx hashes, trust model
frontend/        Next.js board + in-browser snarkjs proving (issuer / inclusion / board)
PRD.md, ARCHITECTURE.md
```

## Limitations (honest, consolidated)

- **Book omission is now prevented by member-authored registration plus
  in-circuit signatures.** `signed_solvency.circom` verifies each member's
  Baby-JubJub EdDSA signature INSIDE the SNARK and exposes signer keys as public
  inputs. `submit_signed_attestation` pins those keys position-by-position
  against the member-self-registered list. An omitted registered member is
  rejected on-chain with `Error #10`. The earlier on-chain-ed25519 tier is
  retained as the weaker fallback. See [`ADVANCED-STATUS.md`](ADVANCED-STATUS.md).
- **Multi-holder same-unit reserves: DONE.** `submit_multi_attestation` binds the
  declared reserves to the aggregate of live 1:1 balances across reserve legs,
  requiring control of every leg. Non-1:1 scale is rejected. NOT-YET: oracle-priced
  cross-asset reserves, cross-chain reserves, and proof of segregated custody.
- **Trusted setup: phase-2 single-contributor.** Groth16 phase-2 is a single-contributor
  setup, not a production multi-party ceremony (phase-1 is the public Hermez ptau). A
  production deployment needs a ceremony. See `circuits/README.md`.
- **Scale wall at depth 10: NOT-YET.** Depth 8 (256 accounts) is fully proved + verified
  (constant ~806-byte proof, sub-second verify). Depth 10 (1,024 accounts) is blocked on
  the 2.3 GB `2^21` Hermez ptau download / phase-2 memory: a provisioning problem, not a
  circuit problem. See [`BENCHMARKS.md`](BENCHMARKS.md).
- **Testnet only, unaudited deps.** Not for real value.
- **Rejected-proof tx.** An invalid proof is rejected during Soroban preflight (contract
  error `#1`), so it never lands on-ledger and has no tx hash: the intended security
  outcome, explained in `contracts/M2-STATUS.md`.

## Build / test / deploy

```bash
NODE=/Users/kamal/.nvm/versions/node/v23.10.0/bin/node
$NODE contracts/scripts/convert.js            # snarkjs -> Rust consts + hex args
cd contracts && cargo test -p tessera-ledger   # 6 on-chain-verify tests
stellar contract build
stellar contract deploy --wasm target/wasm32v1-none/release/tessera_ledger.wasm \
  --source zk-deployer --network testnet \
  -- --reserve_holder <new G...> --reserve_token <new C...>
```