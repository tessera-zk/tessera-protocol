# Tessera — Confidential Treasury Attestations on Stellar: PRD

> Status: shipped submission for **Stellar Hacks: Real-World ZK**. Every feature under "In Scope (shipped)" runs on-chain on Stellar **testnet, Protocol 27**, with a real snarkjs Groth16 proof verified inside a Soroban contract via BN254 host functions, and a resolvable transaction hash. Items that are genuinely not built are tagged **NOT-YET**.
>
> Authoritative state: `docs/SUBMISSION.md`, `UPGRADES-STATUS.md`, `ADVANCED-STATUS.md`, `BENCHMARKS.md`, `contracts/M2-STATUS.md`, `contracts/M4-STATUS.md`. Competitive map: `docs/COMPETITOR-ANALYSIS.md`. Explorer base: `https://stellar.expert/explorer/testnet/tx/<hash>`.

---

## 1. Problem

Centralised custodians and token issuers repeatedly lied about being solvent, then collapsed. Mt. Gox and FTX both ran fractional or negative internal balances while telling customers funds were 1:1 backed. The standard "proof of reserves" response (publish a Merkle root of liabilities plus a wallet address) has three well-documented holes:

1. **Negative-commitment forgery.** A dishonest issuer inserts fake accounts with *negative* commitments to shrink reported totals and fake health. This is exactly the attack Vitalik's Merkle-sum-tree proposal closes. Source: https://vitalik.ca/general/2022/11/19/proof_of_solvency.html
2. **Privacy vs auditability conflict.** To let every member verify the total, naive schemes leak the full commitment list. Issuers refuse to dox their member book, so audits stay centralised and trust-me.
3. **Unbound, self-declared reserves.** Even sophisticated attestation entries treat the reserves figure as a self-declared number or a scraped balance, with **no cryptographic binding to a real, controlled, on-chain account**, and they cannot prove **non-omission** of a registered member.

Stellar's core market is real money: fiat-backed stablecoins (USDC on Stellar, MoneyGram MGUSD), tokenised treasuries / RWAs (Franklin Templeton BENJI), and anchors bridging banks to chain. These are exactly the issuers regulators and users demand health evidence from, and today they attest with monthly PDFs. Protocol 27 ships native BN254 + Poseidon2 host functions, making on-chain SNARK verification cheap enough to run in a single transaction. The canonical zk-attestation (Summa) is EVM-only with no Stellar verifier.

**The gap:** no turnkey, on-chain-verified attestation for Stellar issuers that (a) rules out hidden negative commitments, (b) proves commitments ≤ treasury, (c) keeps individual commitments private, (d) **binds treasury to a real, controlled, live on-chain balance**, and (e) makes **omitting a registered member cryptographically unprovable**, all checked *on-chain* by a Soroban contract rather than asserted in a PDF.

## 2. What we build (one sentence)

A Soroban-verified Circom + Groth16 attestation system where each epoch the issuer proves, in zero knowledge, `totalCommitments ≤ treasury ≤ real controlled on-chain balance`, every leaf is non-negative and signed by its member with an **in-circuit Baby-JubJub EdDSA** key pinned to a published registered-member set (so **omitting a registered member or forging a signature is cryptographically UNPROVABLE**), with optional **concentration / min-collateralization risk limits** and **multi-asset / multi-holder** treasury, proved **client-side in the browser** and verified on-chain in one transaction, while any member proves their own commitment is included.

ZK is load-bearing: the SNARK is the only thing that proves `sum ≤ treasury`, all-leaves-non-negative, and all-leaves-signed *without* revealing any commitment.

## 3. Target users

| User | Need | What they do |
|------|------|--------------|
| **Fiat-backed stablecoin issuer** | Prove 1:1 backing to regulators and holders without publishing the member book | Runs the browser prover each epoch, submits the attestation tx, authorizes as the treasury holder |
| **Tokenised-treasury / RWA issuer** | Prove tokenised commitments are fully collateralised by controlled reserves, possibly across assets/holders | Multi-asset attestation; every reserve leg holder authorizes |
| **Risk / compliance officer** | Prove the book is not just healthy but sound (no whale, adequate buffer) | Submits a risk attestation with public concentration + min-collateral limits |
| **Token holder / member** | Confirm *my* commitment is counted, and that I cannot be silently omitted | Browser inclusion proof; one-time registration of an EdDSA key into the committed set |
| **Public / auditor / regulator** | Verify health this epoch trustlessly | Reads the on-chain attestation; the contract already verified the SNARK and bound reserves to a live balance |

## 4. User flows (exact, as shipped)

**Flow A: Issuer publishes a health attestation bound to real reserves.**
1. Issuer exports the commitments book for epoch N; the browser builds a Merkle-sum tree (Poseidon), computing `rootHash` and `totalCommitments`.
2. **In the browser** (snarkjs WASM, `lib/prover.ts`), the issuer generates a Groth16 proof; a negative commitment or `commitments > treasury` makes the witness unsatisfiable and throws during witness generation, so no proof exists (that is the security property, surfaced as a specific honest error).
3. Issuer calls `submit_attestation(proof, [root, total, treasury])`. The contract verifies Groth16 via BN254 host functions, reads `balance(reserve_holder, reserve_token)` **cross-contract** and rejects (`ReserveUnbacked #5`) if declared treasury exceeds the live balance, and calls `reserve_holder.require_auth()` so the bound account is a **controlled** account (per-invocation ed25519 challenge + replay nonce, `control_proven: true`). End-to-end: `totalCommitments ≤ treasury ≤ real controlled on-chain balance`. Tx: [`e5061222…2f5a4e62`](https://stellar.expert/explorer/testnet/tx/e506122203af411ff41ddf7628be9e1731060de2c58770b4a39e81492f5a4e62).

**Flow B: In-circuit non-omission (Baby-JubJub EdDSA).**
Each member signs `M = Poseidon(epoch, commitment, nonce)` with a circuit-friendly Baby-JubJub key. `signed_solvency.circom` (43,034 constraints) proves in ZK that **every leaf is signed** (`EdDSAPoseidonVerifier` per leaf) and that the **signer-key multiset hashes to a published `pubkeyHash`** (a PUBLIC input, the registered-member-set commitment), on top of base health. `submit_signed_attestation(proof, [root, total, treasury, epoch, Ax[0..3], Ay[0..3]])` requires `pubkeyHash == registered_set` (published once via `set_registered_set`), binds reserves to the live balance, requires holder control, and stores `non_omission_in_circuit = true`. Omitting a registered member fails at the `pubkeyHash` pin; a forged signature fails inside `EdDSAPoseidonVerifier`, both at witness generation, so no proof can exist. Tx: [`567a09bc…c06383c3d`](https://stellar.expert/explorer/testnet/tx/567a09bc26db29f1fe00a6b0567b6a7997d9772978bf1d9d8eb0c63c06383c3d).

**Flow C: Risk / concentration limits.**
`risk_solvency.circom` (22,094 constraints) proves, on top of health, a **concentration cap** (`commitment_i * 10000 ≤ maxConcBps * totalCommitments` per leaf, no whale) and a **min collateralization floor** (`treasury * 10000 ≥ minCollBps * totalCommitments`, a buffer beyond `T ≥ C`). Both bounds are PUBLIC inputs, so the proof publicly commits to the limits it meets; a concentrated or thin book yields no witness. Testnet: 8 accounts, max single 15.7% < 40% cap, reserves 110% > 105% floor. Tx: [`f9dac6ea…1898541ff`](https://stellar.expert/explorer/testnet/tx/f9dac6eab954988fc0a325753d0e49832ea570790339a4804aecaba1898541ff).

**Flow D: Multi-asset / multi-holder reserves.**
`ReserveLeg { holder, token, scale_num, scale_den }` contributes `balance(holder, token) * scale_num / scale_den`; `aggregate_reserves()` sums live scaled balances cross-contract; `submit_multi_attestation(proof, [root, total, treasury])` verifies the health proof, requires **every leg holder to authorize** (`require_auth` per holder = control of ALL reserve accounts), and enforces `treasury ≤ Σ scaled live balances`. Testnet: two legs (`USDC 189140 × 1/1` + `ZKB 50000 × 2/1`), aggregate **289140** backing declared 189140. Tx: [`aeb8aa6d…614c591c6`](https://stellar.expert/explorer/testnet/tx/aeb8aa6de0968ed01753479f91e5c4e955e740997951639ab4b9a96614c591c6).

**Flow E: Member inclusion.**
A member generates a Groth16 inclusion proof in the browser (private `commitment, path`, public `rootHash, leafCommitment`) and calls `verify_inclusion`; it returns `true` only if their commitment is inside the attested-healthy root. Tx: [`c83185c6…6958ece6`](https://stellar.expert/explorer/testnet/tx/c83185c61ef933e5f9affc4ea5b169079953d8ba1c6c6f71afd219d66958ece6).

## 5. Scope

### In scope (shipped, on-chain, testnet Protocol 27)
- **Health in ZK**: per-leaf non-negativity (`Num2Bits(64)`, the Mt. Gox / FTX fix), Merkle-sum root + total, `totalCommitments ≤ treasury`. (shipped).
- **Member inclusion** proof verified on-chain. (shipped, tx `c83185c6…`).
- **Reserves bound to a real, live on-chain balance**: immutable `__constructor(reserve_holder, reserve_token)`, cross-contract `balance()` read, `ReserveUnbacked` rejection. (shipped, tx `e5061222…`).
- **Proof-of-assets control** via `reserve_holder.require_auth()` (per-invocation ed25519 challenge + nonce, `control_proven: true`). (shipped; 14/14 contract tests incl. `submit_without_reserve_holder_auth_fails`).
- **In-circuit Baby-JubJub EdDSA non-omission**: omitting a registered member or forging a signature is cryptographically **UNPROVABLE** (no witness); reduces to a one-time registration assumption, not per-epoch vigilance. (shipped, `signed_solvency.circom`, tx `567a09bc…c06383c3d`).
- **Risk / concentration limits**: concentration cap + min-collateralization floor, both public. (shipped, `risk_solvency.circom`, tx `f9dac6ea…`).
- **Multi-asset / multi-holder reserves**: scaled legs, per-holder `require_auth`, `treasury ≤ Σ scaled live balances`. (shipped on-chain for two assets under one holder, tx `aeb8aa6d…`).
- **Client-side (in-browser) Groth16 proving** with snarkjs WASM; commitments never leave the tab; unsatisfiable constraints throw with honest per-case errors. (shipped, `frontend/lib/prover.ts`, `frontend/app/issuer`).
- **Scale benchmarks**: constant ~800-byte Groth16 proof and sub-second verify up to depth 8 (256 accounts, 0.98s verify), independent of book size. (shipped, `BENCHMARKS.md`).
- **On-chain-ed25519 signed-leaf non-omission** retained as a weaker vigilance-based fallback tier (an omitted member proves omission on-chain via `verify_signed_claim`). (shipped, tx `a1599256…6aaf5fd71`).

### NOT-YET (honest build targets, not claimed working)
- **NOT-YET: single unified circuit proving health + risk limits + in-circuit non-omission + inclusion all at once.** We ship all four primitives (the only attestation entry that does), but as **separate circuits / attestations** (`solvency`, `signed_solvency`, `risk_solvency`, `inclusion`). A single proof asserting every property simultaneously is a target. The project-level combined edge (health + risk + member inclusion together) already exceeds any single competitor.
- **NOT-YET: embeddable public "healthy ✓ as of `<ts>`, tx `<hash>`" badge + JSON status endpoint.** A live badge an issuer drops on their site plus a machine-readable status endpoint is a distribution/product hook, not built.
- **NOT-YET: multi-*holder* control on-chain.** Unit-tested with two separate holders, but the testnet multi-asset tx used one signer across two assets (a multi-holder tx just needs each holder's auth-entry signature).
- **NOT-YET: depth-10 (1,024-account) proving.** Blocked by the 2.3 GB `2^21` Hermez ptau download / phase-2 memory, a provisioning wall (local ptau mirror / more RAM / rapidsnark), not a circuit problem.
- **NOT-YET: production trusted setup.** Groth16 phase-2 is single-contributor (phase-1 is the public Hermez ptau); production needs a real multi-party ceremony.
- **NOT-YET: segregated unencumbered custody** (control ≠ segregation), cross-chain reserves, and an independently auditable registry for the `pubkeyHash` (published here by a reserve-holder-authorized call).

### Non-goals (out of scope by design)
- Not a privacy-payments / mixer system.
- Not proving the *honesty of the input book*: if the issuer never registers a member at all, no attestation catches it. We close negative-commitment forgery, privacy, unbound reserves, and **omission of a *registered* member**; unregistered omission is Vitalik's own stated caveat.
- Not a new curve or proving system: Circom + Groth16 on BN254, the curve Stellar verifies natively.

## 6. Success criteria (all met unless tagged)

1. A real Soroban contract on testnet verifies a real snarkjs Groth16 proof and stores an attestation only on success. **Met**.
2. A book with a hidden negative commitment is provably rejected (unsatisfiable witness). **Met**.
3. Reserves are bound to a real live on-chain balance and rejected when over-declared (`ReserveUnbacked`); the holder proves control via `require_auth`. **Met** (`e5061222…`).
4. Omitting a registered member or forging a signature is cryptographically unprovable in-circuit. **Met** (`567a09bc…c06383c3d`).
5. Risk limits (concentration + min-collateral) are proven in ZK and stored. **Met** (`f9dac6ea…`).
6. Multi-asset reserves aggregate live scaled balances and back declared reserves. **Met** (`aeb8aa6d…`).
7. A member inclusion proof returns `true` on-chain. **Met** (`c83185c6…`).
8. Every issuer/member proof is generated in the browser; commitments never leave the tab. **Met** (`lib/prover.ts`).
9. README/PRD/SUBMISSION describe only what the deployed code does; only genuinely-unbuilt items are tagged NOT-YET. **Met**.

## 7. Demo script (one continuous take, real proving → real-data binding → on-chain settlement → cheat rejection)

- **0:00–0:25 Hook.** "FTX said it was solvent. It wasn't. Here's a Stellar issuer proving health, non-omission, and risk limits without showing a single member commitment, and the treasury side is real live on-chain data, not a self-declared number."
- **0:25–1:10 Real in-browser proof, bound to real reserves.** In the issuer tab, load a CSV book (with one deliberately negative commitment). The browser prover throws at witness generation, the hidden-negative attack blocked, no proof to submit. Fix the book, re-prove in-tab (snarkjs WASM, commitments never leave the page), submit `submit_attestation`. The contract verifies Groth16, **reads the treasury holder's live on-chain balance cross-contract**, and requires the holder's `require_auth`. Show the tx: `totalCommitments ≤ treasury ≤ real controlled balance`.
- **1:10–1:45 Non-omission is unprovable.** Try to omit a registered member and re-prove: witness generation fails at the `pubkeyHash` pin. Try a forged signature: fails inside `EdDSAPoseidonVerifier`. There is no proof that omits or forges, the strongest sense of "cannot cheat."
- **1:45–2:20 Risk + multi-asset.** Submit a risk attestation (concentration cap + min-collateral floor, both public), then a two-asset attestation where `aggregate_reserves()` sums live scaled balances (289140) backing declared treasury. Show both stored on-chain.
- **2:20–2:45 Member inclusion + cheat rejection.** A member proves inclusion in-browser → `true`. Then over-declare treasury beyond the live balance → the contract rejects at the cross-contract check (`ReserveUnbacked`); withhold the holder's auth → panic at `require_auth`. Cheating is stopped by the chain and the circuit, not the UI.
- **2:45–3:00 Close.** "Real proof in the browser, reserves bound to real controlled on-chain data, omission cryptographically impossible, risk limits public, all verified on Protocol 27." Show the bound-attestation tx hash.

## 8. Why this wins (against the named field)

P2 has three strong twins. The compliance/view-key ground is already taken, so we win on **real data binding**, **real in-browser proving**, **cryptographic non-omission**, and **combined-primitive depth**.

- **Beats Crisp (edycutjong).** Crisp is Circom Merkle-sum with EdDSA-bound liabilities, inclusion, and an aggregator, but its **commitments are a demo sandbox** and its **reserves side is a plaintext public number not bound to a real custody source**, with proving simulated in the web UI. We bind reserves to a **real, live, controlled on-chain balance** the contract reads itself and the holder must authorize, and we prove **client-side in the browser** for real. Crisp binds only liabilities; we bind both sides and prove control.
- **Beats Auspex (RECTOR-LABS).** Auspex adds concentration/liquidity limits, but its **assets are self-declared private witnesses** (no live on-chain source binding), it is single-institution with **no per-member liabilities inclusion**, and Noir-only. We match its risk depth (concentration + min-collateralization) **and** add member inclusion **and** bind reserves to real controlled balances, so we are the only entry proving **health + risk limits + member inclusion together**.
- **Beats mzterwal's Confidential PoR.** It has view-key ratio decryption and inclusion, but **assets are public but unbound** and RISC Zero proofs are heavier. Our reserves are unbound-to-nobody: they are cryptographically pinned to a controlled live balance, and our non-omission is **enforced inside the SNARK** (omission is unprovable, not merely victim-detectable).
- **Non-omission that is unprovable, not just detectable.** In-circuit Baby-JubJub EdDSA per leaf plus a pinned signer-key multiset means a health proof that omits a registered member simply **cannot be generated**, reducing to a one-time registration assumption rather than per-epoch bulletin-board vigilance. No twin does this.
- **ZK is principal, not decorative, and reproducible.** The Groth16 verifier runs inside Soroban via BN254 host functions; every claim maps to a resolvable testnet tx. Genuinely-unbuilt items (single unified circuit, public badge/JSON endpoint, multi-holder on-chain tx, depth-10, production ceremony) are tagged NOT-YET, matching README to code.

## References
- Vitalik, "Having a safe CEX: proof of solvency and beyond": https://vitalik.ca/general/2022/11/19/proof_of_solvency.html
- SNARKed Merkle Sum Tree (Ethereum Research): https://ethresear.ch/t/snarked-merkle-sum-tree-a-practical-proof-of-solvency-protocol-based-on-vitaliks-proposal/14405
- Summa proof-of-solvency: https://github.com/summa-dev/summa-solvency
- ZK on Stellar docs: https://developers.stellar.org/docs/build/apps/zk
- soroban-examples groth16_verifier: https://github.com/stellar/soroban-examples/tree/main/groth16_verifier