# Tessera — Circuits

Circom + Groth16 circuits on **BN254** (circom's default curve, the one Stellar
Protocol 27 "X-Ray" verifies natively). Core circuits:

| Circuit | What it proves | Public signals |
|---|---|---|
| `solvency.circom` | The whole commitment set is non-negative, its Merkle-sum root is correct, and `totalCommitments <= treasury` — all in zero knowledge. | `[rootHash, totalCommitments, treasury]` |
| `inclusion.circom` | One member's commitment was counted in the attested root, in zero knowledge. | `[rootHash, leafCommitment]` |
| `signed_solvency.circom` (UPGRADE 1 + FIX 1) | Health **plus** every leaf carries a valid in-circuit Baby-JubJub EdDSA signature by its owner, **and each leaf's signer key `(Ax_i, Ay_i)` is a PUBLIC input** the contract pins against the member-self-registered key list. Omitting a registered member yields a valid proof that is **rejected on-chain** (Error #10); forging a signature is unprovable in-circuit. | `[rootHash, totalCommitments, treasury, epoch, Ax[0..3], Ay[0..3]]` |
| `signed_inclusion.circom` (UPGRADE 1) | Depth-2 inclusion instance matching the signed demo tree. | `[rootHash, leafCommitment]` |
| `risk_solvency.circom` (UPGRADE 3) | Health **plus** a **per-leaf** concentration cap (no leaf > `maxConcBps`‱ of the set) and a min collateralization (`treasury >= minCollBps`‱ of commitments), all in zero knowledge. A violating book is unprovable. **FIX 3 honest scope:** the cap is per-LEAF, not per-member (a whale can split across leaves); per-member needs FIX 1's keyed leaves merged in (NOT-YET). | `[rootHash, totalCommitments, treasury, maxConcBps, minCollBps]` |

All are verified end-to-end with real snarkjs Groth16 proofs (see
[Verified results](#verified-results)). The UPGRADE circuits + their on-chain
verification and real testnet transactions are documented in
[`../ADVANCED-STATUS.md`](../ADVANCED-STATUS.md).

> **Non-omission (FIX 1): member-verifiable, issuer-uncontrollable.**
> `signed_solvency` verifies each member's signature inside the SNARK and exposes
> each leaf's signer key as a PUBLIC input. The contract pins those keys against an
> on-chain list each member self-registered under their own authorization
> (`register_customer_key`), position-by-position. An issuer cannot author the set,
> so a proof over a set missing a registered member is **rejected on-chain**
> (Error #10, demonstrated on testnet). Forgery remains unprovable in-circuit. This
> supersedes the earlier issuer-published-`pubkeyHash` scheme (which the issuer
> could author to omit a member) and the on-chain-ed25519 / bulletin-board tier.
> Caveat: a malicious single-contributor Groth16 setup could forge proofs.

---

## Merkle-sum tree construction

Independent MIT implementation of Vitalik's proof-of-solvency / Summa design,
using circomlib's BN254 Poseidon. Templates live in `lib/merkle_sum.circom`.

```
acctCommit_i = Poseidon(acctId_i, salt_i)          # hides account identity
leaf.hash    = Poseidon(acctCommit_i, commitment_i)   leaf.sum = commitment_i
parent.hash  = Poseidon(Lh, Ls, Rh, Rs)            parent.sum = Ls + Rs
root         = (rootHash, totalCommitments)
```

Carrying the running **sum** into the same commitment as the hash structure is
what defeats the naive-Merkle negative-commitment attack. Each leaf is also
range-checked with `Num2Bits(64)`, so a field-negative commitment (the Mt.Gox /
FTX forgery) is unrepresentable.

### The three health guarantees (all enforced as constraints)

1. **Non-negativity** — `Num2Bits(balanceBits)` on every leaf forces
   `commitment ∈ [0, 2^64)`. `solvency.circom:44`.
2. **Sum correctness** — the circuit recomputes the Merkle-sum root from the
   private commitments and asserts `computedRoot === rootHash` and
   `computedSum === totalCommitments`. `solvency.circom:64-65`.
3. **Health** — `LessEqThan(cmpBits)` asserts `totalCommitments <= treasury`,
   with `treasury` independently range-checked so it cannot be a field-wrapped
   value. `solvency.circom:88`.

`balanceBits = 64` and `depth = 4` keep the widest quantity
(`totalCommitments < 2^(64+4)`) far below the ~254-bit BN254 field, so the sum
additions cannot overflow.

---

## Parameters

Demo instantiation (bottom of each circuit file):

```circom
component main = Solvency(4, 64);    // depth 4 => up to 16 accounts, 64-bit balances
component main = Inclusion(4, 64);
```

`DEPTH` and `balanceBits` are template parameters — change the `main`
instantiation to resize the tree (e.g. `Solvency(3,64)` for 8 accounts).

---

## Constraint counts (`snarkjs r1cs info`)

| Circuit | Constraints | Public inputs | ptau | Prove time |
|---|---:|---:|---|---:|
| `solvency`  | **20,511** | 3 | 2^15 | ~1 s |
| `inclusion` | **3,550**  | 2 | 2^15 | <1 s |
| `signed_solvency` (UP1+FIX1, depth 2, 4 in-circuit EdDSA sigs) | ~34,300 | 12 | **2^16** | ~2 s |
| `signed_inclusion` (UP1, depth 2) | **2,066** | 2 | 2^15 | <1 s |
| `risk_solvency` (UP3, depth 4, 16 leaves) | **22,094** | 5 | 2^15 | 1.11 s |

`signed_solvency` needs the larger **2^16** Hermez ptau
(`powersOfTau28_hez_final_16.ptau`, ~72 MB) because in-circuit Baby-JubJub EdDSA is
~8.5k constraints per signature; the others fit the 2^15 ptau.

---

## Powers of tau

Single shared **BN254 Perpetual Powers of Tau (Hermez)** phase-1 ceremony:

```
powersOfTau28_hez_final_15.ptau     (2^15 = 32,768 constraints, ~37 MB)
```

Power 15 is the smallest Hermez ptau that fits the larger circuit (`solvency`,
20,511 constraints); it also covers `inclusion` (3,550, which alone would only
need 2^12). Using the public Hermez phase-1 removes half the trusted-setup
concern — only the per-circuit phase-2 is project-specific.

Downloaded from `https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau`.

---

## Build / prove / verify

Toolchain uses **PATH-resolved binaries** (CI-friendly):

- circom `2.2.3` — `which circom`
- node `v23.10.0` — `which node`
- snarkjs `0.7.6` — invoked as `$(which node) $(which snarkjs)`
- circomlib `2.0.5`, circomlibjs `0.1.7` — installed locally in `node_modules/`

### One-shot

```bash
bash scripts/build.sh     # compile + fetch ptau + groth16 phase-2 + export vkeys (idempotent)
bash scripts/prove.sh     # gen inputs + prove + verify + 2 negative tests
```

### What each step runs (BN254, no -p flag)

```bash
CIRCOM=$(which circom)
NODE=$(which node)
SNARKJS="$NODE $(which snarkjs)"

# 1. compile
$CIRCOM circuits/solvency.circom  --r1cs --wasm --sym -o build/

# 2. phase-2 setup (single contributor, DISCLOSED non-ceremony)
$SNARKJS groth16 setup build/solvency.r1cs ptau/powersOfTau28_hez_final_15.ptau build/solvency_0000.zkey
$SNARKJS zkey contribute build/solvency_0000.zkey circuit-keys/solvency_final.zkey -e="tessera v1 entropy solvency"
$SNARKJS zkey export verificationkey circuit-keys/solvency_final.zkey circuit-keys/vk_solvency.json

# 3. prove + verify
$NODE scripts/gen_input.js
$SNARKJS wtns calculate build/solvency_js/solvency.wasm build/inputs/solvency_input.json build/proofs/solvency.wtns
$SNARKJS groth16 prove circuit-keys/solvency_final.zkey build/proofs/solvency.wtns \
         build/proofs/solvency_proof.json build/proofs/solvency_public.json
$SNARKJS groth16 verify circuit-keys/vk_solvency.json \
         build/proofs/solvency_public.json build/proofs/solvency_proof.json   # -> OK!
```

---

## Public signals layout (contract-facing — DO NOT REORDER)

`snarkjs` writes `public.json` as a flat JSON array in this exact order. The
Soroban verifier contract must read the signals in the same order.

### `solvency` — `public.json` = `[rootHash, totalCommitments, treasury]`

| Index | Signal | Type / meaning |
|---|---|---|
| 0 | `rootHash` | BN254 Fr — Merkle-sum root hash |
| 1 | `totalCommitments` | BN254 Fr — sum carried in the root (≤ 2^68 for these params) |
| 2 | `treasury` | BN254 Fr — attested treasury figure |

Example (real, from `build/proofs/solvency_public.json`):

```json
[
  "18476080664104167364283550003171561992385021811003715219434465972790703878135",
  "184140",
  "189140"
]
```

### `inclusion` — `public.json` = `[rootHash, leafCommitment]`

| Index | Signal | Type / meaning |
|---|---|---|
| 0 | `rootHash` | BN254 Fr — must equal the stored attestation root |
| 1 | `leafCommitment` | BN254 Fr — `Poseidon(acctCommit, commitment)` |

### `signed_solvency` (FIX 1) — `public.json` = `[rootHash, totalCommitments, treasury, epoch, Ax[0..3], Ay[0..3]]`

| Index | Signal | Type / meaning |
|---|---|---|
| 0 | `rootHash` | BN254 Fr — signed Merkle-sum root hash |
| 1 | `totalCommitments` | BN254 Fr — sum carried in the root |
| 2 | `treasury` | BN254 Fr — attested treasury figure |
| 3 | `epoch` | BN254 Fr — freshness epoch (must strictly increase on-chain, FIX 4) |
| 4..7 | `Ax[0..3]` | BN254 Fr — signer Baby-JubJub public-key x per leaf |
| 8..11 | `Ay[0..3]` | BN254 Fr — signer Baby-JubJub public-key y per leaf |

The contract (`submit_signed_attestation`) pins `Ax[i] = signal 4+i` and
`Ay[i] = signal 8+i` against the member-self-registered ordered key list.

`nPublic`: solvency = 3, inclusion = 2, signed_solvency = 12, risk_solvency = 5.
`curve: bn128`, `protocol: groth16` (confirmed in `circuit-keys/vk_*.json`).

---

## Verified results

Captured in `logs/prove_run.log`. `SUMMARY: pass=4 fail=0`.

| # | Case | Input | Expectation | Result |
|---|---|---|---|---|
| 1 | Health, valid + healthy | `solvency_input.json` | proof VERIFIES | `snarkJS: OK!` ✅ |
| 2 | Inclusion, valid path | `inclusion_input.json` | proof VERIFIES | `snarkJS: OK!` ✅ |
| 3 | **Underfunded** book | `solvency_insolvent.json` (`treasury = total − 1`) | REJECTED | `Assert Failed ... Solvency line: 88` (LessEqThan) ✅ |
| 4 | **Negative commitment** | `solvency_negbalance.json` (leaf = `p − 100`) | REJECTED | `Assert Failed ... Num2Bits line: 38` (range check) ✅ |

Both negative cases fail at **witness calculation** because the violated
constraint is unsatisfiable — no proof can be produced, which is the security
property we want. The tree in the negative-commitment case is internally
consistent (root and sum recomputed with the negative leaf), so the ONLY thing
rejecting it is the per-leaf range proof.

---

## Trusted-setup caveat (honest disclosure)

The Groth16 phase-2 here is a **single-contributor setup**, run by
`scripts/build.sh` with inline entropy for reproducibility. **This is NOT a
production-safe ceremony.** Whoever ran the phase-2 could, in principle, forge
proofs. A production deployment requires a multi-party phase-2 ceremony
(multiple independent contributors, published transcript). This is the same
disclosure Nethermind ships for their non-ceremony CRS, and is tracked as
`NOT-YET` in `PRD.md`.

The BN254 **phase-1** (`powersOfTau28_hez_final_15.ptau`) IS the public
Perpetual Powers of Tau ceremony, so only the per-circuit phase-2 is the
project's own single-contributor step.

### Assets + omission (now addressed on-chain — see `UPGRADES-STATUS.md`)
- **Proof of assets.** `treasury` is no longer trusted: it is bound on-chain to a
  real token balance (M4) AND the treasury holder must **authorize** each
  attestation, proving control of that account (UPGRADE 2, Soroban `require_auth`).
- **Member omission.** Each member signs their `(commitment, nonce, leaf_commitment)`
  leaf with their ed25519 (Stellar) key; the contract re-verifies those signatures
  on-chain and publishes the signed-leaf registry (UPGRADE 1). An issuer that omits
  a member can be caught: the omitted member's signed claim verifies on-chain while
  their leaf is provably absent from the attested root. This does not make the
  circuit change — the signature binds the member's key into `acctCommit` off-circuit
  and is verified on-chain, not in the SNARK. **Honest caveat:** omission is
  *detectable by the victim*, not unilaterally preventable — it needs members to keep
  their signed claim and check each epoch (the bulletin-board assumption, same as
  Vitalik/Summa). The stronger in-circuit-signature variant is documented NOT-YET.

---

## Files

```
circuits/
  solvency.circom          # issuer: whole-tree health proof
  inclusion.circom         # member: membership in the attested root
  signed_solvency.circom   # in-circuit EdDSA non-omission (FIX 1)
  signed_inclusion.circom  # depth-2 inclusion for signed demo
  risk_solvency.circom     # concentration + min-collateral (UPGRADE 3)
  lib/merkle_sum.circom    # Merkle-sum tree + inclusion-level templates (MIT)
  lib/solvency_tpl.circom  # base health template
  lib/signed_solvency_tpl.circom  # in-circuit EdDSA template (FIX 1)
  lib/risk_solvency_tpl.circom    # risk template (UPGRADE 3)
  README.md                # this file
scripts/
  build.sh                 # compile + ptau + groth16 phase-2 + export vkeys
  build_signed.sh          # FIX1 signed_solvency build
  prove.sh                 # gen inputs + prove + verify + negative tests
  prove_signed.sh          # FIX1 signed proofs
  prove_risk.sh            # UP3 risk proofs
  bench.sh                 # depth scaling benchmark
  gen_input.js             # builds the JS Merkle-sum tree, emits witness inputs
  gen_input_n.js           # parametric depth-N input generator
  gen_signed_incircuit.js  # FIX1 witness generator
  gen_signed_demo.js       # legacy ed25519 demo inputs
  gen_signed_fixtures.js   # legacy ed25519 contract fixtures
  gen_risk_input.js        # UP3 risk witness generator
  testnet_demo.sh          # legacy ed25519 testnet flow
  testnet_signed_demo.sh   # FIX1 testnet flow
  testnet_risk_demo.sh     # UP3 testnet flow
circuit-keys/              # vk_*.json + *_final.zkey (committed for the demo)
build/                     # r1cs, wasm, witnesses, proofs (generated)
ptau/                      # powersOfTau28_hez_final_15.ptau (downloaded)
logs/prove_run.log         # captured proof + negative-test output
```