# Keyed binding analysis (issue #37)

Why the FIX 3 hole (unconstrained `acctCommit[]`) cannot recur in the keyed
design — and what the binding does and does not cover.

## The chain, link by link

1. `acct[i] = Poseidon(Ax[i], Ay[i], nonces[i])` — identity commitment. There
   is NO private `acctCommit` input to substitute; the only freedom is the
   nonce (per-leaf randomness, bound into the signature message in designs
   that sign, e.g. `UnifiedSolvency`).
2. `leaf[i] = Poseidon(acct[i].out, balances[i])` — balance inseparable from
   identity. Moving balance B from leaf i to leaf j changes both leaf hashes.
3. `MerkleSumRoot` folds `(leafHash[i], balances[i])` — sum and membership
   recomputed, pinned to public `rootHash`/`totalLiabilities`.
4. `(Ax[i], Ay[i])` PUBLIC — the contract pins the exact ordered key set
   (FIX 1 pattern). Substituting a key breaks the pin on-chain even if the
   proof is valid.

## What binding covers

- Leaf-identity substitution (the FIX 3 evasion): closed — any balance move
  changes the root the proof commits to.
- Key substitution: rejected on-chain (#10 pattern).
- Unregistered-leaf smuggling: rejected on-chain (pin length == registered
  count).

## What binding does NOT cover

- Sybil (two keys, one human): out of circuit scope — policy doc governs.
- Signature authenticity (prototype has no EdDSA verify): anyone knowing a
  registered `(Ax, Ay)` — which is PUBLIC — can build the leaf preimage, but
  cannot produce a proof without the private key material... precisely, they
  cannot produce a SIGNED proof; the UNSIGNED keyed prototype needs the
  EdDSA merge (remediation item R1) before this matters on-chain.
- Nonce reuse across epochs: harmless for binding (nonce is identity
  randomness, not freshness); freshness comes from `epoch` (FIX 4) in signed
  designs.
