# Tessera — Submission

Fill the bracketed fields before submitting. Everything else is written and accurate to the code.

- Project name: Tessera
- Track: Stellar Real-World ZK
- Team: [YOUR NAME / HANDLE]
- Live demo video: [VIDEO LINK]
- Repo: [REPO LINK]
- Network: Stellar testnet, Protocol 27

## Tagline

Private proofs, public trust. On-chain treasury health for Stellar issuers, with zero member data exposed.

## One-line pitch

An issuer proves its treasury is healthy on Stellar without revealing a single member commitment, using a zero knowledge proof generated in the browser and verified on-chain by a Soroban contract, with the treasury figure bound to a real, controlled on-chain balance.

## What it is

A confidential attestation system for stablecoin, tokenized treasury, and real-world asset issuers on Stellar. Instead of a monthly PDF that is stale, self declared, and can silently omit members, the issuer publishes a live cryptographic attestation that anyone can verify on-chain. The private member book never leaves the issuer's browser.

## The problem

Reserve transparency today is a trust-me PDF. It is out of date the moment it is signed, the issuer declares its own numbers, and nothing stops it from leaving members out of the book. After FTX, the market learned that self reported solvency is not solvency. Stellar is becoming a home for stablecoins and RWAs, and that ecosystem is missing a real trust layer.

## Who it is for

Stablecoin issuers, tokenized treasury and RWA issuers, anchors, on and off ramp providers, auditors, regulators, and the token holders who want to verify inclusion themselves.

## How it works

1. The issuer loads a private commitment set in the browser. Commitments are private witnesses and never leave the tab.
2. The browser builds a Merkle-sum tree with Poseidon over BN254, then generates a Groth16 attestation proof with snarkjs. Only the root, total, and treasury leave, wrapped in the proof.
3. The treasury holder signs the submission with Freighter. A Soroban contract verifies the Groth16 proof on-chain using BN254 host functions and stores the attestation only if it holds.
4. At verification the contract reads the treasury holder's live on-chain balance cross-contract and rejects any attestation where declared treasury exceeds the real balance. Final chain: commitments at most treasury, treasury at most a real controlled balance.
5. Members self register a Baby-JubJub key on-chain. The signed attestation pins those keys, position by position, so the issuer cannot omit a registered member.
6. Any member proves their own commitment is included under the certified root, in the browser, without revealing the commitment.

## Standout and advanced features

- Treasury binding to a live, controlled on-chain balance, via a cross-contract read plus require_auth. Most attestation entries stop at reserves at least liabilities with a self declared number.
- In-circuit non-omission pinned to member self-registered keys. The issuer never authors the set, so it cannot silently drop a member.
- Refusals are first class and tested: negative commitment forgery is unprovable, over-declared treasury is rejected as unbacked, stale roots are refused, and a weaker attestation cannot downgrade a stronger one.
- Risk limits proven in zero knowledge: concentration cap and minimum collateralization enforced against a contract policy floor.
- Same-token multi-holder treasury that aggregates several controlled accounts, with arbitrary token inflation explicitly rejected.
- Product surface: a public health badge page and a JSON status endpoint an issuer can embed on its own site, backed by the live attestation.
- Real wallet signing with Freighter through Stellar Wallets Kit.

## Why it wins against competitors

The field around attestations either simulates proving, self declares assets, or leaves reserves unbound. This project does the hard combination at once: real in-browser proving, real on-chain verification on Stellar, treasury bound to a controlled balance, and non-omission that the issuer cannot fake. It also ships the product wrapper competitors skip, a badge and an endpoint, so an issuer could actually adopt it.

## Architecture

```
   Issuer browser (private)                 Stellar testnet (public)
   commitment set (secret)                  Soroban Tessera contract
        v                                     verify Groth16 (BN254 host fns)
   Merkle-sum tree (Poseidon)                 treasury >= commitments
        v                                     treasury <= live balance (cross-contract)
   Groth16 proof (snarkjs) --- proof --->     pin member keys (non-omission)
   root, total, treasury only                 refuse stale / unbacked / forged
        +--- Freighter signs (treasury holder authorizes) ---+
   Reserve token account --- balance read ---> contract
```

## Proof it is real

- Authoritative contract: CBTN433JB2LSFHPLGEZTLEW43IKKXPKN5AYHJVMLKO4NN6EQNBVDRJP4
- Contract tests: 26 passing, including replay, downgrade, control, and non-omission cases
- Every cited transaction resolves on stellar.expert
- Stack: Circom plus Groth16, snarkjs in the browser, Soroban verifier with BN254 and Poseidon

## Honest limitations

- Groth16 phase two is single contributor and disclosed; production needs an MPC ceremony.
- Multi-holder treasury is same token; oracle priced cross-asset is the next step.
- Concentration cap is per leaf; per-member needs keyed risk leaves.

## Try it

1. Start the frontend in projects/tessera-protocol/frontend.
2. Open the attestation console, generate a proof, connect the treasury-holder wallet, submit.
3. Open the ledger and the badge, and verify the transaction on stellar.expert.