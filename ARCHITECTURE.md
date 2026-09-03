# Architecture — ZK Proof-of-Reserves on Stellar

Companion to `PRD.md`. Every version and claim below is cited. Where an exact value could not be pinned from a primary source, it is marked **VERIFY** with the check to run.

---

## 1. System diagram

```
                      OFF-CHAIN (prover, trusted setup)                 ON-CHAIN (Soroban / Protocol 25+)
  liabilities.csv
  (acct id, balance)
        |
        v
  +-----------------+      builds Merkle-sum tree (Poseidon)
  | prover (Node +  |----> rootHash, totalLiabilities
  | snarkjs 0.7.6)  |
        |
        |  witness = all balances (private)
        |  public  = rootHash, totalLiabilities, reserves
        v
  +-----------------+   proof.json + public.json    +-----------------------------+
  | solvency.circom |------------------------------>| proof_of_reserves contract  |
  | Groth16 prove   |   publish_attestation(...)    |  - groth16_verify(vk_solv,  |
  +-----------------+                                |      proof, [root,tot,res]) |
                                                     |  - assert stored only if OK |
  +-----------------+                                |  - store Attestation{...}   |
  | browser (WASM)  |   verify_inclusion(...)        |                             |
  | inclusion.circom|------------------------------>|  - groth16_verify(vk_incl,  |
  | Groth16 prove   |   public = [root, leafCommit]  |      proof, [root,leaf])    |
  +-----------------+                                |  - assert root == stored    |
     ^ user's balance                                +-----------------------------+
     stays local                                          ^ get_attestation(epoch)
                                                           | (public, read-only)
                                                     anyone / auditor / regulator
```

The prover proves off-chain; the contract verifies on-chain. This is the cheapest split and the one Protocol 25 was designed for.

---

## 2. Curve and proving-system decision

**Decision: Circom + Groth16 on BN254, verified on-chain via Stellar Protocol 25 X-Ray BN254 host functions.** BLS12-381 (reusing the ready-made soroban-examples verifier) is the documented fallback.

### The two real options

| | **BN254 (recommended)** | **BLS12-381 (fallback)** |
|---|---|---|
| snarkjs / circom support | Default curve (`bn128`). No `-p` flag. snarkjs 0.7.6 native. | Supported via `circom -p bls12381` + snarkjs `bls12381`. Less-trodden. |
| circomlib gadgets (Poseidon, Num2Bits, LessThan, comparators) | Native. Constants are defined over the BN254 scalar field, so they work unmodified. | circomlib's Poseidon round constants are generated for the BN254 field. Under `-p bls12381` the field changes, so Poseidon/comparator gadgets need BLS12-381-parameterised constants. Real friction. **VERIFY** before committing. |
| Phase-1 trusted setup | Public Perpetual Powers of Tau (Hermez `powersOfTau28_hez`) is BN254. Only a per-circuit phase-2 needed. | No widely-trusted public BLS12-381 ptau; must run our own phase-1 (toy). |
| On-chain verifier | Protocol 25 BN254 host functions `bn254_g1_add`, `bn254_g1_mul`, `bn254_multi_pairing_check` (CAP-0074). Must write/port the Groth16 verifier contract. | **Ready-made**: `soroban-examples/groth16_verifier` already implements it on BLS12-381 with soroban-sdk 25.1.0. Biggest de-risk. |
| Reference implementations | Nethermind stellar-private-payments (BN254, Apache-2.0) is a working Soroban BN254 Groth16 verifier to port from. Official ZK docs target BN254. | soroban-examples verifier (BLS12-381). |
| Browser WASM proving | Standard, well-supported. | Works but less common for `bls12381`. |

### Why BN254 wins for this project
The novel work here is the **circuit** (Merkle-sum tree + range proofs + inclusion), and the entire standard Circom toolchain (circomlib Poseidon, Num2Bits range checks, LessEqThan comparators) is field-specific to BN254. Building on BN254 means those gadgets work unmodified, the public Hermez phase-1 ceremony removes half the trusted-setup concern, and both the official Stellar ZK docs and the Nethermind reference target BN254. The one cost is that the turnkey soroban-examples verifier is BLS12-381, so we port its logic (identical structure: `g1_mul`/`g1_add`/`pairing_check` accumulate `vk_x`, then one pairing check) to the BN254 host functions, using Nethermind's Apache-2.0 verifier as the reference.

### Fallback trigger
If porting the BN254 verifier contract or wiring the BN254 host-function API stalls in week 1, switch to BLS12-381: reuse `soroban-examples/groth16_verifier` verbatim, compile the same circuits with `circom -p bls12381`, and supply BLS12-381-parameterised Poseidon constants. This keeps a working on-chain-verified proof reachable either way. No CLI upgrade is needed for either path (local Stellar CLI is already 27.0.0).

**VERIFY (week-1 spike, before committing to BN254):**
1. Exact soroban-sdk 25.1.0 Rust API for BN254 (method names on `env.crypto()`). CAP-0074 confirms three BN254 host functions exist in Protocol 25; the SDK wrapper names must be read from https://docs.rs/soroban-sdk/25.1.0 . Source discussion: https://github.com/orgs/stellar/discussions/1826 , CAP-0074: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md
2. That circomlib Poseidon over BN254 matches whatever Poseidon the tree builder uses off-circuit (same t, round constants).

---

## 3. Circom circuit spec

Field: BN254 scalar field (circom default). Hash: Poseidon from circomlib (as in Summa, `H(username, balance)` at leaves).

### Merkle-sum tree shape (per Vitalik / Summa)
- **Leaf node** for account i: `hash = Poseidon(acctCommitment_i, balance_i)`, `sum = balance_i`, where `acctCommitment_i = Poseidon(acctId_i, salt_i)` so account identity is not leaked.
- **Internal node**: `hash = Poseidon(L.hash, L.sum, R.hash, R.sum)`, `sum = L.sum + R.sum`.
- **Root**: `(rootHash, totalLiabilities)`.

This binds the aggregate sum into the same commitment as the membership structure, which is what defeats the naive Merkle-tree negative-balance attack. Source: https://vitalik.ca/general/2022/11/19/proof_of_solvency.html , node formula per Summa: https://github.com/summa-dev/summa-solvency

### `solvency.circom` (issuer proves the whole tree)
```
template Solvency(nLeaves, balanceBits) {
    // ---- public inputs ----
    signal input rootHash;            // committed Merkle-sum root hash
    signal input totalLiabilities;    // committed total in the root
    signal input reserves;            // attested reserve figure (public)

    // ---- private witnesses ----
    signal input balances[nLeaves];
    signal input acctCommit[nLeaves]; // Poseidon(acctId, salt) per leaf

    // 1. NON-NEGATIVITY: every balance in [0, 2^balanceBits)
    //    Num2Bits(balanceBits) forces the value to fit in unsigned range,
    //    so a negative (field-wrapped) balance is unrepresentable -> Mt.Gox/FTX fix.
    component rng[nLeaves];
    for (i=0..nLeaves) { rng[i] = Num2Bits(balanceBits); rng[i].in <== balances[i]; }

    // 2. SUM CORRECTNESS: recompute the Merkle-sum root from the leaves
    //    leaf.hash = Poseidon(acctCommit[i], balances[i]); leaf.sum = balances[i]
    //    parent.hash = Poseidon(Lh, Ls, Rh, Rs); parent.sum = Ls + Rs
    //    (log2(nLeaves) layers of Poseidon)
    //    -> computedRootHash, computedSum
    computedRootHash === rootHash;
    computedSum      === totalLiabilities;

    // 3. SOLVENCY: liabilities <= reserves
    component le = LessEqThan(balanceBits + log2(nLeaves) + 1);
    le.in[0] <== totalLiabilities; le.in[1] <== reserves; le.out === 1;
}
component main {public [rootHash, totalLiabilities, reserves]} = Solvency(16, 64);
```
Public signal order (must match the contract): `[rootHash, totalLiabilities, reserves]`.

Notes: `balanceBits = 64` bounds each balance well below the BN254 field modulus (~254 bits), so the sum of up to `nLeaves` balances cannot overflow the field, closing the overflow hole Summa also guards. We add the **explicit** per-leaf range proof that Summa's circom variant leaves implicit, giving a legible "no negative balances" guarantee. Summa ref: https://github.com/summa-dev/circuits-circom (GPL-3.0).

### `inclusion.circom` (user proves membership in the attested root)
```
template Inclusion(depth, balanceBits) {
    signal input rootHash;            // public: the on-chain attested root
    signal input leafCommitment;      // public: this user's leaf hash (so they recognise it)

    signal input balance;             // private
    signal input acctCommit;          // private
    signal input siblingHash[depth];  // private: co-path node hashes
    signal input siblingSum[depth];   // private: co-path node sums
    signal input pathIndex[depth];    // private: 0/1 left-right selectors

    component rng = Num2Bits(balanceBits); rng.in <== balance;  // leaf non-negative

    // leaf.hash = Poseidon(acctCommit, balance); leaf.sum = balance
    // fold up depth layers using pathIndex to order (self, sibling)
    // parent.hash = Poseidon(Lh, Ls, Rh, Rs); parent.sum = Ls + Rs
    computedRoot === rootHash;
    leafHash     === leafCommitment;
}
component main {public [rootHash, leafCommitment]} = Inclusion(4, 64);
```
Public signal order: `[rootHash, leafCommitment]`.

Two circuits mean two verification keys (`vk_solvency`, `vk_inclusion`) stored in the contract.

---

## 4. Soroban contract (`proof_of_reserves`)

soroban-sdk 25.1.0, Rust 1.89.0 (matching the upstream verifier example). The Groth16 verification core is ported from `soroban-examples/groth16_verifier` (its `verify_proof(vk, proof, pub_signals) -> bool` accumulates `vk_x` via `g1_mul`/`g1_add` over the IC vector and public signals, then runs one `pairing_check` of `e(-A,B)·e(alpha,beta)·e(vk_x,gamma)·e(C,delta) == 1`). On BN254 the same logic uses the Protocol 25 BN254 host functions.

### Storage
```rust
struct Attestation {
    root: BytesN<32>,          // Merkle-sum root hash (Fr)
    total_liabilities: u128,
    reserves: u128,
    timestamp: u64,
}
// instance storage: admin address, vk_solvency, vk_inclusion (set at init)
// persistent storage: map<epoch:u32 -> Attestation>
```

### Public methods
```rust
fn init(env, admin: Address, vk_solvency: VerificationKey, vk_inclusion: VerificationKey);

// Flow A: issuer publishes. Panics (stores nothing) unless the Groth16 proof verifies.
fn publish_attestation(
    env, epoch: u32,
    root: BytesN<32>, total_liabilities: u128, reserves: u128,
    proof: Proof,
) {
    admin.require_auth();
    let pub_signals = [fr(root), fr(total_liabilities), fr(reserves)];
    if !groth16_verify(&vk_solvency, &proof, &pub_signals) { panic!("bad proof"); }
    // solvency (total <= reserves) is enforced INSIDE the circuit, so a valid
    // proof already means solvent; store it.
    attestations.set(epoch, Attestation { root, total_liabilities, reserves, timestamp: now });
}

// Flow C: public read. Existence == contract verified the SNARK.
fn get_attestation(env, epoch: u32) -> Option<Attestation>;

// Flow B: user inclusion. Returns true only if the proof verifies AND
// its root equals the stored, already-solvency-verified root.
fn verify_inclusion(env, epoch: u32, leaf_commitment: BytesN<32>, proof: Proof) -> bool {
    let att = attestations.get(epoch).expect("no attestation");
    let pub_signals = [fr(att.root), fr(leaf_commitment)];
    groth16_verify(&vk_inclusion, &proof, &pub_signals) && (root_of(pub_signals) == att.root)
}
```

Host-function call site (BN254 path, **VERIFY exact method names** against docs.rs/soroban-sdk/25.1.0):
```rust
let bn = env.crypto().bn254();          // VERIFY: method name/module
let acc = bn.g1_mul(ic[i], signal[i]);  // accumulate vk_x
let acc = bn.g1_add(acc_prev, acc);
let ok  = bn.multi_pairing_check(&g1_points, &g2_points);
```
BLS12-381 fallback call site (verbatim from the example, already compiles on soroban-sdk 25.1.0):
```rust
let bls = env.crypto().bls12_381();
let acc = bls.g1_mul(ic[i], signal[i]);
let acc = bls.g1_add(acc_prev, acc);
let ok  = bls.pairing_check(vp1, vp2);
```
Source: https://github.com/stellar/soroban-examples/tree/main/groth16_verifier (lib.rs uses `env.crypto().bls12_381()` with `g1_mul`, `g1_add`, `pairing_check`; `verify_proof(vk, proof, pub_signals)`).

---

## 5. Pinned toolchain (all verified)

| Tool | Version | How verified | Source |
|------|---------|--------------|--------|
| circom | 2.2.3 | `circom --version` on this machine | https://docs.circom.io/getting-started/installation/ |
| snarkjs | 0.7.6 | `snarkjs --version` on this machine; supports both `bn128` and `bls12381` | https://www.npmjs.com/package/snarkjs , https://github.com/iden3/snarkjs |
| Stellar CLI | 27.0.0 | `stellar --version` on this machine (already > Protocol 25; no upgrade needed) | https://github.com/stellar/stellar-cli |
| soroban-sdk | 25.1.0 | upstream `groth16_verifier/Cargo.toml` | https://github.com/stellar/soroban-examples/tree/main/groth16_verifier |
| Rust | 1.89.0 | upstream `rust-toolchain.toml` for the verifier example | (same repo) |
| circomlib | latest (Poseidon, Num2Bits, comparators) | BN254-field gadgets | https://github.com/iden3/circomlib |
| Protocol | 25 "X-Ray" (BN254 + Poseidon host fns; CAP-0074 / CAP-0075). Testnet vote Jan 7 2026, Mainnet vote Jan 22 2026 | | https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25 , https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md |

Note on the user's existing `stellar-vault` repo: its `soroban-sdk` is 22.0.8 and an older assumption put the CLI at 23.0.0. Neither applies here. This new project pins soroban-sdk 25.1.0, and the installed CLI is already 27.0.0, so **no CLI upgrade is required** for either curve path. The only version bump is the SDK dependency inside this new contract crate.

---

## 6. Reference implementations

| Project | Use to us | Curve / stack | License | URL |
|---|---|---|---|---|
| soroban-examples `groth16_verifier` | Port the on-chain Groth16 verify logic; direct reuse for the BLS12-381 fallback | BLS12-381, soroban-sdk 25.1.0 | (soroban-examples repo license — Apache-2.0, **VERIFY** LICENSE) | https://github.com/stellar/soroban-examples/tree/main/groth16_verifier |
| Nethermind stellar-private-payments | Reference for a working BN254 Groth16 Soroban verifier + browser WASM proving + circom project layout (`circuits/`, `contracts/`, `app/`, `sdk/`, `circuit-keys/`) | Circom + Groth16 + Soroban, WASM proving | Apache-2.0 (except `circuits/build.rs` under LGPL-3.0) | https://github.com/NethermindEth/stellar-private-payments |
| Summa `circuits-circom` | Merkle-sum-tree circuit design (`ToLeafHash = Poseidon(username, balance)`, node = `Poseidon(Lh,Ls,Rh,Rs)`, sum = `Ls+Rs`, liabilities ≤ assets) | Circom / BN254 | GPL-3.0 | https://github.com/summa-dev/circuits-circom |
| Summa `summa-solvency` | Protocol design, overflow guard reasoning | Halo2 + circom | (repo LICENSE, **VERIFY**) | https://github.com/summa-dev/summa-solvency |
| Vitalik PoR writeup | Merkle-sum-tree spec, negative-balance attack, caveats | spec | n/a | https://vitalik.ca/general/2022/11/19/proof_of_solvency.html |
| SNARKed Merkle Sum Tree | Practical SNARK-of-solvency construction | spec | n/a | https://ethresear.ch/t/snarked-merkle-sum-tree-a-practical-proof-of-solvency-protocol-based-on-vitaliks-proposal/14405 |

License note: Summa `circuits-circom` is GPL-3.0. We use it as **design reference only** and write our own circuits to keep this repo's license clean; we do not copy GPL circuit source.

---

## 7. Repo layout

```
zk-proof-of-reserves/
  PRD.md
  ARCHITECTURE.md
  circuits/
    solvency.circom
    inclusion.circom
    lib/                # local Merkle-sum templates (own impl, MIT)
  contracts/
    proof-of-reserves/
      Cargo.toml        # soroban-sdk = "25.1.0"
      rust-toolchain.toml  # 1.89.0
      src/lib.rs        # publish_attestation / get_attestation / verify_inclusion
      src/groth16.rs    # ported verify (BN254 primary, BLS12-381 fallback)
      src/test.rs       # real proof fixtures verified in-contract
  prover/
    build-tree.ts       # CSV -> Merkle-sum tree (Poseidon), root + total
    prove-solvency.ts   # snarkjs groth16 fullProve
    submit.ts           # publish_attestation via stellar CLI / JS SDK
  app/                  # minimal web: issuer publish + user inclusion (WASM proving)
  scripts/
    setup.sh            # ptau + phase-2 groth16 setup, export vkeys
  circuit-keys/         # .zkey + verification_key.json (committed for demo)
  KNOWN-RPC-ISSUES.md   # testnet indexer-lag retry notes
```

---

## 8. Build sequence

```bash
# 1. Compile circuits (BN254 default; add `-p bls12381` only on fallback)
circom circuits/solvency.circom  --r1cs --wasm --sym -o build/
circom circuits/inclusion.circom --r1cs --wasm --sym -o build/

# 2. Trusted setup
#    BN254: reuse public Perpetual Powers of Tau (Hermez) phase-1
#    BLS12-381 fallback: `snarkjs powersoftau new bls12381 ...` (own phase-1, toy)
snarkjs groth16 setup build/solvency.r1cs pot_final.ptau solvency_0000.zkey
snarkjs zkey contribute solvency_0000.zkey solvency_final.zkey  # phase-2 (single contributor, disclosed)
snarkjs zkey export verificationkey solvency_final.zkey circuit-keys/vk_solvency.json
# repeat for inclusion

# 3. Prove (off-chain), produce proof.json + public.json
snarkjs groth16 fullProve input.json build/solvency_js/solvency.wasm solvency_final.zkey proof.json public.json
snarkjs groth16 verify circuit-keys/vk_solvency.json public.json proof.json   # sanity

# 4. Verifier contract: encode vk + proof + public signals, build, deploy
stellar contract build
stellar contract deploy --wasm target/wasm32-unknown-unknown/release/proof_of_reserves.wasm --network testnet

# 5. End-to-end on Testnet
#    publish_attestation(...) with the real proof -> get_attestation returns it
#    tamper the proof -> tx panics, nothing stored (demo negative case)

# 6. Frontend: reuse the compiled .wasm + .zkey for browser inclusion proving
```

Proof/public-signal encoding into Soroban XDR types follows the soroban-examples verifier's expected `VerificationKey`/`Proof`/`Vec<Fr>` shapes.

---

## 9. Real blockers (flagged honestly)

1. **BN254 SDK API surface (P0, week-1 spike).** CAP-0074 confirms three BN254 host functions in Protocol 25, but the exact soroban-sdk 25.1.0 Rust wrapper names are not yet pinned from a primary source. Read https://docs.rs/soroban-sdk/25.1.0 first. If the wrapper is immature, take the BLS12-381 fallback (ready verifier) with zero schedule risk.
2. **circomlib Poseidon field on the fallback path.** circomlib Poseidon constants are BN254-field. If we fall back to `circom -p bls12381`, we must supply BLS12-381-parameterised Poseidon (regenerated constants) or the hash gadget is wrong. Not a problem on the BN254 primary path. This is the single strongest reason the primary path is BN254.
3. **Trusted setup is not production-safe.** Groth16 needs a per-circuit phase-2 ceremony. The hackathon uses a single-contributor phase-2 (BN254 reuses the public Hermez phase-1). This is disclosed in the README exactly as Nethermind discloses their non-ceremony CRS. Tagged `NOT-YET` for a real ceremony.
4. **Proof of assets is out of scope.** `reserves` is a trusted public input this epoch. A dishonest issuer could inflate it. Closing this needs on-chain proof-of-assets (signatures over reserve wallets), tagged `NOT-YET`. The negative-balance and privacy problems are fully solved; the reserves-honesty problem is explicitly future work, stated in both docs.
5. **Testnet indexer lag.** Wrap `waitForTransactionReceipt`-equivalent reads in retries; log to `KNOWN-RPC-ISSUES.md`.
6. **Book omission is unsolvable by any PoR.** Documented as a non-goal, matching Vitalik's own caveat.
