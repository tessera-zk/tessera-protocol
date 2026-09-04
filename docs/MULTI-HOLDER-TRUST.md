# Multi-holder trust model (issue #7)

Backing = sum of live, same-unit, **controlled** balances.

- Each leg: `balance(holder_i, token_i)` read cross-contract at submit time.
- Control: `holder_i.require_auth()` for EVERY leg. A stored multi attestation
  means each holder signed this attestation's auth challenge at this ledger.
- Same-unit (FIX 2): `scale_num == scale_den == 1` enforced on-chain
  (Error #13 otherwise). No issuer-set price. A worthless SAC cannot be
  scaled up to fake backing.
- Bound: `treasury <= aggregate`. Over-declaration rejected; overflow is an
  explicit Error #15, never silent.

What this does NOT prove:

- Cross-asset prices (needs Reflector oracle, issue #10, NOT-YET).
- Segregated / unencumbered custody (control != segregation, NOT-YET).
- Single-signer testnet caveat: the shipped testnet multi tx used one signer
  across two assets. A two-signer tx is the production bar (this runbook).
