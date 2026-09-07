# Keyed-risk Sybil policy (issue #37)

## Problem

Per-keyed-position caps assume one registered key per real member. Attack:
one human registers keys K1, K2 (both pass `register_customer_key` today —
there is no uniqueness-of-human check), splits balance B into B/2 + B/2, and
each position passes a cap that B alone would breach. The circuit cannot
distinguish this from two genuine members. No constraint change fixes it.

## Policy options

| Option | Mechanism | Cost | Verdict |
|---|---|---|---|
| A. Minimum-balance floor | Registration requires `balance >= floor`; splitting N ways costs N floors | Sybils pay linearly; hurts small members | Weak alone |
| B. Identity-gated registration | One key per KYC'd identity (issuer attests off-chain, member authorizes on-chain) | Reintroduces issuer trust in the identity step | Pragmatic for regulated issuers |
| C. Registration bond | Slashed/key-revoked on proven Sybil (fraud proof by any watcher) | Needs fraud-proof design | Strong but NOT-YET designed |
| D. Accept + disclose | Cap documented as per-key; issuers monitor off-chain | Zero mechanism cost | Honest minimum — current stance |

## Recommendation

Ship D now (prototype already claims per-key only). For production, B for
regulated stablecoin issuers (their compliance already KYCs holders) with C
as the trust-minimized follow-up. A is not recommended (punishes small
holders without stopping funded Sybils).

## What this PR does NOT do

No contract changes, no registration-flow changes. This doc records the
decision surface so the audit finding "Sybil evasion" arrives with an
approved answer, not a surprise.
