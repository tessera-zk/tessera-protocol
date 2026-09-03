# ZK Proof-of-Reserves - Demo Video Script (5 minutes)

How to use this file: the left column time is when you say the line. Text in quotes is what you speak. Text in brackets is the on-screen action. Speak slowly and let each on-chain result land.

Testnet only. Everything shown is real: real proofs generated in the browser, real transactions verified on Stellar.

---

## 0:00 - 0:30  Hook and the trust gap

"After FTX collapsed, every stablecoin and tokenized asset issuer started saying the same sentence: trust us, the reserves are there. What they hand you is a monthly PDF signed by an accountant. That PDF is stale the moment it is printed, it is self declared, and it can quietly leave customers out of the numbers."

"A proof of reserves should be three things a PDF is not. It should be live, it should be cryptographic, and it should be impossible to fake. That is what this project is, and it runs on Stellar."

[Open the landing page. Then open the Solvency Board so the judge sees a live on-chain status, not a slide.]

---

## 0:30 - 1:15  What exactly are we proving

"Let me be precise about the claim, because a vague claim is a weak claim. An issuer holds a private book of customer liabilities. We prove three linked facts at once."

"One. Every customer balance is non negative. That blocks the exact Mt. Gox and FTX trick where a negative number is hidden in the book to shrink the apparent total."

"Two. The sum of all customer balances is at most the reserves. That is solvency."

"Three. The declared reserves are at most a real balance that the issuer actually controls on Stellar right now."

"And we prove all of that without publishing a single customer balance. The individual numbers never leave the issuer's browser."

[On the Issuer console, point at the liabilities book. Say clearly: these balances are private witnesses, they are inputs to the proof, they are never sent anywhere.]

---

## 1:15 - 2:10  Live proof generation and on-chain verify

"Here is the honest part that most demos skip. The proof is generated right here in the browser. Nothing is precomputed."

"When I run it, the browser builds a Merkle-sum tree using the Poseidon hash over the BN254 curve. Every leaf is a customer, and each node carries a running sum. Then it generates a Groth16 zero knowledge proof with snarkjs. The only things that leave this tab are the root, the total, and the reserves, all wrapped inside the proof."

[Click generate. Narrate the step list as it runs: build tree, prove, encode, submit.]

"Now I connect the reserve holder wallet with Freighter and submit. The Soroban contract verifies the Groth16 proof on-chain using Stellar's BN254 host functions, and it stores the attestation only if the proof is valid."

[Show the transaction hash. Open it on stellar.expert so the judge sees successful on-chain verification.]

"This is the differentiator. At verification the contract also reads the reserve holder's live balance on-chain, cross contract, and rejects the attestation if the declared reserves are larger than that real balance. So the final chain is: liabilities at most reserves, reserves at most a real balance the issuer controls."

---

## 2:10 - 3:00  Watch it refuse to lie

"A proof system is only as good as what it refuses. Let me try to cheat, three ways."

"First, I forge a negative balance, the classic trick to make the book look smaller than it is. The circuit has a range check on every leaf, so this witness is unsatisfiable. No proof can be produced. Nothing is submitted."

[Click forge negative balance. Show the rejection. Emphasize: the proof does not exist, so there is nothing to send.]

"Second, I declare more reserves than actually exist on-chain. The contract rejects it as unbacked, because the declared number exceeds the live balance."

"Third, I replay an old proof to reuse yesterday's healthy numbers. The contract refuses the same root a second time. Stale solvency is not solvency."

---

## 3:00 - 3:55  The hard part: non-omission

"Now the feature I am most proud of, because it is the one competitors hand wave. Proving the total is backed is not enough. A dishonest issuer can simply drop a customer from the book and still show a nice ratio. So we prove non-omission, and we do it in the circuit."

"Each customer self registers a Baby-JubJub public key on-chain, under their own wallet authorization. The issuer never authors that list. When the issuer produces the signed attestation, the proof exposes the signer key for every leaf, and the contract pins those keys, position by position, against the customer registered list."

"So if the issuer tries to omit a registered customer or substitute a filler key, the on-chain check fails and the attestation is rejected. The issuer cannot silently leave someone out."

[Open the Advanced tab and show the signed attestation evidence and the rejection path.]

"And the customer can verify their own side. On the inclusion page a customer enters their balance, the browser builds an inclusion proof against the attested root, and the contract confirms membership. The balance never leaves the tab, only the proof does."

[Open My Inclusion, show verify returns true.]

---

## 3:55 - 4:30  From demo to product

"For this to matter to a real issuer it has to be more than a circuit. So there is a product surface. There is a public solvency badge, and a JSON status endpoint that an issuer can embed on its own website, both backed by the on-chain attestation, not by a static image."

[Open the Badge page, then show the /api/solvency JSON response.]

"There are also advanced attestations: portfolio risk limits proven in zero knowledge, and same token multi holder reserves that aggregate several controlled accounts. These raise the bar beyond a plain reserves at least liabilities check."

---

## 4:30 - 5:00  Architecture in one breath, and close

"Here is the whole system in one sentence. The browser is the prover, Stellar is the verifier, and the reserve binding is what ties the math to reality."

[Show the architecture diagram from the pitch deck or README.]

"The private book stays client side. Circom and Groth16 produce the proof. A Soroban contract verifies it with BN254 host functions, binds the reserves to a live controlled balance with a cross contract read and a wallet authorization, pins the customer key set for non-omission, and refuses stale or unbacked or forged inputs."

"Real zero knowledge, real on-chain verification, real reserve binding, on Stellar. This is proof of reserves that actually proves. Thank you."

---

## Standout features to emphasize if asked

- Reserve binding to a live on-chain balance, not a self declared number. Most entries stop at reserves at least liabilities.
- In-circuit non-omission pinned to customer self-registered keys. The issuer cannot author the set.
- Refusals are first class: negative balance unprovable, unbacked rejected, stale root refused, downgrade blocked.
- Browser proving with a Soroban on-chain verifier, no trusted server doing the math.
- Product surface: embeddable solvency badge and JSON endpoint, wallet signing with Freighter.

## Reference facts to keep on screen

- Authoritative contract: CBTN433JB2LSFHPLGEZTLEW43IKKXPKN5AYHJVMLKO4NN6EQNBVDRJP4
- Network: Stellar testnet, Protocol 27, BN254 plus Poseidon host functions
- Stack: Circom plus Groth16, snarkjs in the browser, Soroban verifier
- Wallet: Freighter via Stellar Wallets Kit signs the reserve-holder attestation
- Contract tests: 26 passing
