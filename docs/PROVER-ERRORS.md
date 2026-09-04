# Prover errors — honest failure map (issue #14)

Witness-generation throws are the security property, not bugs. Map:

| code | when | user sees |
|---|---|---|
| `NEGATIVE_COMMITMENT` | `Num2Bits(64)` fails | Fix the negative commitment; no proof exists |
| `UNDERFUNDED` | `total > treasury` comparator fails | Raise reserves or fix book |
| `WHALE_LEAF` | per-LEAF cap fails (FIX 3 scope) | Reduce leaf or relax public cap |
| `THIN_COLLATERAL` | `minCollBps` floor fails | Add buffer |
| `FORGED_SIGNATURE` | `EdDSAPoseidonVerifier` fails | Re-sign with member key |
| `OMITTED_MEMBER` | on-chain pin #10 | Include every registered member |
| `STALE_EPOCH` | replay #14 | Use fresh epoch |
| `RESERVE_UNBACKED` | cross-contract #5 | Lower declared treasury |
| `MISSING_AUTH` | `require_auth` panic | Add holder auth |
| `BAD_RESERVE_LEG` | non-1:1 #13 | Use same-unit legs |

Implementation: `frontend/lib/errors.ts` (`classifyProverError`,
`errorAdvice`). Issuer/inclusion pages should catch prover throws, classify,
and render `advice` verbatim (no raw constraint dump to end users).
