# ZK Proof-of-Reserves - Pitch Deck (content plus speaker notes)

Each slide has three parts. Slide text is what you put on the slide. Say this is what you speak. Keep slides sparse and let the speaker notes carry the detail.

---

## Slide 1 - Title

Slide text:
- ZK Proof-of-Reserves on Stellar
- Prove solvency without revealing a single customer balance
- Real Groth16 proofs, verified on-chain by a Soroban contract

Say this:
"This is a proof of reserves system on Stellar. The one line to remember is this: an issuer can prove it is solvent, on-chain, without publishing any customer balance. Everything I show is live on testnet, not slideware."

---

## Slide 2 - Problem

Slide text:
- Issuers ask users to trust monthly PDF attestations
- PDFs are stale, self declared, and can hide omitted customers
- FTX proved self reported solvency is not solvency

Say this:
"Today reserve transparency is a PDF. It is stale the day it is signed, the issuer declares its own numbers, and nothing stops it from leaving customers out of the book. After FTX, the market learned the hard way that self reported solvency means nothing. The trust layer is missing."

---

## Slide 3 - Who has this pain

Slide text:
- Stablecoin issuers, tokenized treasury and RWA issuers
- Anchors and on and off ramp providers
- Auditors, regulators, and token holders

Say this:
"This is not a niche. Every stablecoin issuer, every tokenized asset issuer, every anchor on Stellar has to answer one question: are the reserves really there. Regulators want it, auditors want it, and the token holders want to check it themselves. That is our user set."

---

## Slide 4 - Insight

Slide text:
- Solvency is provable, not merely assertable
- Liabilities at most reserves, reserves at most a real controlled balance
- No individual balance is ever exposed

Say this:
"Our insight is simple. Solvency is a mathematical statement, so it can be proven instead of asserted. And the proof must connect to reality: not just liabilities at most reserves, but reserves at most a balance the issuer actually controls on-chain. All of it while keeping every customer balance private."

---

## Slide 5 - Solution

Slide text:
- Browser builds a Merkle-sum tree and a Groth16 solvency proof
- Soroban contract verifies the proof on-chain
- Contract binds reserves to the live on-chain balance

Say this:
"The issuer's browser builds a Merkle-sum tree over the private book and generates a Groth16 proof. A Soroban contract on Stellar verifies that proof on-chain and stores an attestation only if it holds. Then the part nobody else does: the contract reads the reserve holder's live balance on-chain and rejects anything that is not actually backed."

---

## Slide 6 - Architecture

Slide text (show this diagram):
```
   Issuer browser (private)                 Stellar testnet (public)
  ---------------------------              ----------------------------
   liabilities book (secret)               Soroban PoR contract
        |                                     |  verify Groth16 (BN254)
        v                                     |  reserves <= liabilities? no, >=
   Merkle-sum tree (Poseidon)                 |  reserves <= live balance?
        |                                     |  pin customer keys (non-omission)
        v                                     |  refuse stale / unbacked / forged
   Groth16 proof (snarkjs)  --- proof --->    |
        |                                     v
   root, total, reserves only            stored Attestation + events
        |                                     ^
        +--- Freighter wallet signs ----------+
             (reserve holder authorizes)
   Reserve token account (SAC) --- balance read cross-contract ---> contract
```

Say this, pointing at the diagram in this order:
"Read it left to right. On the left is the issuer's browser, and everything there is private. The book becomes a Merkle-sum tree using Poseidon, then snarkjs produces a Groth16 proof. Only three public numbers leave: the root, the total, and the reserves."

"The arrow crossing the middle is the proof. On the right is Stellar. The Soroban contract verifies the proof with BN254 host functions. Then it does three checks a normal verifier would not: it confirms reserves cover liabilities, it reads the reserve account's live balance cross contract and confirms the declared reserves are actually backed, and it pins the customer key set so no one was omitted."

"The wallet arrow at the bottom is important. The reserve holder signs the attestation with Freighter, so the account that backs the reserves is the same account that authorizes the proof. That is why this is control, not just a number."

---

## Slide 7 - Standout feature 1: reserve binding

Slide text:
- Reserves bound to a real, controlled on-chain balance
- Cross contract balance read plus wallet authorization
- Rejects declared reserves that exceed the live balance

Say this:
"Most proof of reserves demos stop at reserves at least liabilities, where reserves is a number the prover typed in. We bind that number to a live on-chain balance and require the holder to authorize with their key. So the reserves figure is a fact about Stellar state, not a claim."

---

## Slide 8 - Standout feature 2: non-omission

Slide text:
- Customers self register a Baby-JubJub key on-chain
- Signed attestation pins those exact keys, position by position
- Issuer cannot author the set, so it cannot drop a customer

Say this:
"This is the feature I want judges to remember. Backing the total is not enough if you can quietly delete a customer. Each customer registers their own key on-chain under their own wallet. The proof exposes the signer key per leaf, and the contract checks them against that registered list. The issuer cannot forge or omit, because it does not control the list."

---

## Slide 9 - Standout feature 3: refusals

Slide text:
- Negative balance forgery is unprovable
- Over declared reserves rejected as unbacked
- Stale roots refused, weaker attestations cannot downgrade

Say this:
"A proof system earns trust by what it rejects. A hidden negative balance cannot produce a proof at all. Over declared reserves are rejected on-chain. A replayed old proof is refused. And a weaker attestation cannot overwrite a stronger one. These are tested cases, not slogans."

---

## Slide 10 - Product surface

Slide text:
- Public solvency badge and JSON status endpoint
- Wallet signing with Freighter
- Risk limits and same token multi holder reserves

Say this:
"To be adopted this has to look like issuer infrastructure. So there is an embeddable solvency badge and a JSON endpoint an issuer drops on its own site, backed by the live attestation. There is wallet signing. And there are advanced attestations for risk limits and multi holder reserves for issuers with more complex balance sheets."

---

## Slide 11 - Proof it is real

Slide text:
- Deployed and verified on Stellar testnet, Protocol 27
- 26 passing contract tests including replay, downgrade, control
- Every cited transaction resolves on stellar.expert

Say this:
"This is not a mock. It is deployed on testnet, there are 26 passing contract tests covering the adversarial cases, and every transaction I reference resolves publicly on stellar.expert. You can verify me while I talk."

---

## Slide 12 - Why now and close

Slide text:
- Stellar is pushing real world assets and stablecoins on-chain
- Reserve transparency is the missing trust layer
- Proof of reserves that actually proves

Say this:
"Stellar is becoming a home for stablecoins and real world assets, and those need a trust layer that a PDF cannot provide. We built the piece that was missing: cryptographic, live, and impossible to fake, on Stellar. Proof of reserves that actually proves. Thank you."

---

## Q and A quick answers

- Trusted setup: the Groth16 phase two here is single contributor and disclosed; production needs an MPC ceremony. Say it plainly, it builds credibility.
- Scale: proof size and verify cost stay roughly constant as the book grows; deeper trees are a provisioning task, not a redesign.
- Cross asset reserves: current multi holder aggregation is same token; oracle priced cross asset is the next step.
