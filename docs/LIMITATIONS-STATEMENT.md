# Limitations statement (issue #44) — plain language

Tessera proves, in zero knowledge and verified on-chain, that a set of
private commitments is non-negative, correctly summed, and covered by
controlled on-chain reserves — with registered members un-omittable and
risk bounds optionally enforced.

It does NOT prove:

1. That the member set is COMPLETE — unregistered members are invisible
   (inherent to all proof-of-reserves; see Vitalik's writeup).
2. That reserves are SEGREGATED or unencumbered — control is proven,
   custody quality is not.
3. That concentration is safe PER MEMBER today — the live cap is per leaf.
4. Anything about ASSET PRICES — only same-unit aggregation is enforced;
   cross-asset backing needs the Reflector integration (not built).
5. Anything at 1,024 accounts — verified ceiling is 256.
6. Anything under a production setup ceremony — current keys are
   single-contributor; a malicious setup could forge proofs.
7. Anything on mainnet with real value — testnet only, unaudited.

Anyone representing Tessera capabilities beyond the evidence index
(`docs/EVIDENCE-INDEX.md`) is misrepresenting the project.
