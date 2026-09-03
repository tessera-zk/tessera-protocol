# Milestone 2 — On-chain Groth16 verification on Stellar testnet

**Status: DONE.** A Soroban contract verifies our real BN254 Groth16 proofs
on-chain (Protocol 27 BN254 host functions), stores the attestation only when
the solvency proof is valid, checks user inclusion proofs against the stored
root, and rejects tampered proofs. All hashes below are real and re-queryable.

## Deployed contract

| Item | Value |
|---|---|
| Network | Stellar **testnet** (Protocol 27) |
| Contract ID | `CB7TTXIUAFIUSICXTAZRB6MNVON6Y3V24RRYNEGF5NGDAOX75L3UBDKD` |
| Wasm hash | `a0f0bb2b175b9ab9635a4907709aef35491388b608b4dbf752b6c47c26841e0b` |
| Deployer | `zk-deployer` = `GBZK7Z6DMDBVFOURA76RXRQKPIHXTJFGN6CVRMU3J6ZE55YCZBHG3XG2` |
| Explorer | https://stellar.expert/explorer/testnet/contract/CB7TTXIUAFIUSICXTAZRB6MNVON6Y3V24RRYNEGF5NGDAOX75L3UBDKD |

## Real transactions (all re-queryable via Horizon)

| Action | Tx hash | Ledger | Result |
|---|---|---|---|
| Upload wasm | `54cb59e33721e6732dd5f04c625daf1a8b99b760d65eca58dfb47f9672cd6128` | — | success |
| Create contract | `3d73ffc043f45aa9a76aa11d98bf66b2f596120393f4910757462f649c799b48` | — | success |
| **Submit REAL solvency proof** | `b5051e7fbf83d0865132a6fd9ebd94cd07981d7b2559071cd8305755c71df746` | 3383119 | success, returned epoch `0`, emitted `attest/solvent` event |
| **Verify REAL inclusion proof** | `c83185c61ef933e5f9affc4ea5b169079953d8ba1c6c6f71afd219d66958ece6` | 3383191 | success, returned `true` |
| **Tampered proof** | (no ledger tx — see note) | — | rejected at preflight: `Error(Contract, #1)` = `InvalidSolvencyProof` |
| **Submit from BROWSER (frontend)** | `869002f2d874ff0f2c95456f08cc03f947219443a18cfbc6ad2a05b4c8fd290e` | 3383439 | success, stored epoch `2`, Horizon `successful: true` |

### Browser-generated attestation (frontend/ click-through)

The `frontend/` web app generates the Groth16 solvency proof entirely
client-side with snarkjs (WASM) and submits `submit_attestation` from the
browser. Tx `869002f2d874ff0f2c95456f08cc03f947219443a18cfbc6ad2a05b4c8fd290e`
was produced by a headless click-through of the issuer console (real Poseidon
Merkle-sum tree + real snarkjs proving in-browser, no CLI, no pre-baked proof),
confirmed on Horizon:

```bash
curl -s https://horizon-testnet.stellar.org/transactions/869002f2d874ff0f2c95456f08cc03f947219443a18cfbc6ad2a05b4c8fd290e \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['hash'],d['successful'],d['ledger'])"
# -> 869002f2...d290e True 3383439
```

The same run drove the browser inclusion flow (`verify_inclusion` simulated to
`true` for a customer's real balance) and the negative-balance forgery demo
(witness generation fails at the `Num2Bits` range check, so no proof and no
submission). See `frontend/README.md`.

Re-query any hash:
```bash
curl -s https://horizon-testnet.stellar.org/transactions/b5051e7fbf83d0865132a6fd9ebd94cd07981d7b2559071cd8305755c71df746 \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['hash'],d['successful'],d['ledger'])"
```

Stored attestation read back on-chain (`get_attestation`):
```json
{"epoch":0,
 "root_hash":"28d91750661fb24465616eb4ef70f381c7863cd970d17f4da840d102264eeff7",
 "total_liabilities":"...0002cf4c",   // 184140
 "reserves":"...0002e2d4",             // 189140
 "timestamp":1782930358}
```
`reserves (189140) >= totalLiabilities (184140)` — solvent.

## Contract interface (`contracts/proof-of-reserves/src/lib.rs`)

| Function | Behaviour |
|---|---|
| `submit_attestation(proof: BytesN<256>, public_signals: Vec<BytesN<32>>) -> u32` | Runs the solvency Groth16 pairing check with Protocol 27 BN254 host fns. Panics (`InvalidSolvencyProof`) on a bad proof, `MalformedPublicInputs` on wrong signal count, `Insolvent` if `reserves < totalLiabilities`. On success stores `Attestation{rootHash, totalLiabilities, reserves, timestamp, epoch}`, emits an event, returns the epoch. |
| `verify_inclusion(proof: BytesN<256>, public_signals: Vec<BytesN<32>>) -> bool` | Loads the stored attestation (panics `NoAttestation` if none). Returns `false` if the proof's `rootHash != stored root`. Otherwise runs the inclusion Groth16 check and returns whether it verifies. |
| `get_attestation() -> Option<Attestation>` | Latest verified attestation. |
| `epoch_count() -> u32` | Number of attestations stored. |

Public-signal order (from `circuits/README.md`, unchanged):
`solvency = [rootHash, totalLiabilities, reserves]`, `inclusion = [rootHash, leafCommitment]`.

## Byte-encoding notes (the #1 failure point — solved)

The converter `contracts/scripts/convert.js` turns snarkjs `vk_*.json` /
`*_proof.json` / `*_public.json` into the exact layout `soroban_sdk::crypto::bn254`
`from_bytes` expects. Verified against Nethermind's `soroban-utils` encoders and
their `circuit-keys::g2_to_soroban_bytes`:

- **Fq / Fr**: 32-byte **big-endian**.
- **G1** (`[x, y, "1"]`): `x(32) || y(32)` = 64 bytes.
- **G2** (`[[x_c0, x_c1], [y_c0, y_c1], ...]`): Soroban wants the **imaginary
  component first**, so `x.c1 || x.c0 || y.c1 || y.c0`, each 32-byte BE = 128
  bytes. snarkjs stores `[c0, c1]`, so we take index `[1]` then `[0]`. This same
  swap applies to **both** the VK G2 points and the proof's `pi_b`.
- **Proof**: `A(G1,64) || B(G2,128) || C(G1,64)` = **256 bytes**, passed as a
  single `BytesN<256>`.
- **Public signal**: each field element as a 32-byte BE `BytesN<32>`.

The VKs are embedded at compile time (`src/vk_data.rs`, generated). Proofs and
public signals are passed as call args (`contracts/artifacts/onchain-args.json`
holds the hex used for the on-chain txs).

## Commands (reproduce end-to-end)

```bash
NODE=/Users/kamal/.nvm/versions/node/v23.10.0/bin/node

# 1. Convert snarkjs artifacts -> vk_data.rs, test_fixtures.rs, onchain-args.json
$NODE contracts/scripts/convert.js

# 2. Test on-chain verify against the REAL proof (6 tests: valid verifies,
#    tampered panics, inclusion true, wrong-root false, etc.)
cd contracts && cargo test -p proof-of-reserves

# 3. Build + deploy
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/proof_of_reserves.wasm \
  --source zk-deployer --network testnet
CID=CB7TTXIUAFIUSICXTAZRB6MNVON6Y3V24RRYNEGF5NGDAOX75L3UBDKD

# 4. Submit real proofs (args from onchain-args.json; Vec<BytesN<32>> via file-path)
stellar contract invoke --id $CID --source zk-deployer --network testnet -- \
  submit_attestation --proof <SOLVENCY_PROOF_HEX> --public_signals-file-path sol_pub.json
stellar contract invoke --id $CID --source zk-deployer --network testnet --send=yes -- \
  verify_inclusion --proof <INCLUSION_PROOF_HEX> --public_signals-file-path inc_pub.json
```

## Honest note on the "rejected tampered proof" tx

Soroban builds a transaction's resource footprint from a **successful preflight
simulation**. The tampered proof makes the contract trap during that preflight
(the BN254 pairing check fails, contract error `#1 InvalidSolvencyProof`), so the
CLI/RPC returns the error **before** a transaction can be assembled or sent to
the ledger. This is the intended security outcome: an invalid proof provably
cannot store an attestation and cannot even consume ledger space. The rejection
is real and executed by the real host (see the diagnostic event
`topics:[error, Error(Contract, #1)]` in the invoke output), but it therefore
has **no on-ledger tx hash** — by design, not a workaround. The unit test
`tampered_solvency_proof_is_rejected` exercises the same rejection deterministically.

## Provenance / license

The Groth16 pairing core (`src/groth16.rs`) is forked from Nethermind's
`stellar-private-payments` `circom-groth16-verifier` (Apache-2.0). The
attestation storage, inclusion/root-binding logic, converter, and tests are this
project's own work.
