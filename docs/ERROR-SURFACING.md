# Error surfacing (issue #41)

`frontend/lib/errors.ts` is now wired into pages. Flow for every prover or
submit throw:

```
throw  ->  toErrorOutcome(err)  ->  { code, detail }  ->  <ErrorBanner code detail />
              (lib/proverErrors.ts)      (typed)             (components/ErrorBanner.tsx)
```

## Mapping

| Throw source | Code path |
|---|---|
| `WitnessError kind=negative-balance` | NEGATIVE_COMMITMENT |
| `WitnessError kind=insolvent` | UNDERFUNDED |
| `WitnessError kind=wrong-balance` | FORGED_SIGNATURE (wrong commitment entered) |
| `WitnessError kind=unknown` | UNKNOWN |
| Any other throw | `classifyProverError(message)` (11 codes) |

## Page coverage

- Issuer (`app/issuer`): outer catch carries `{code, detail}`; banner renders
  when `code` present, legacy card otherwise. The `rejected` path
  (WitnessError at prove step) is unchanged.
- Inclusion (`app/inclusion`): same pattern on the run catch.
- Board/advanced pages: read-only surfaces, no prover throws — unchanged.

## Rule

New catch blocks on prover paths must use `toErrorOutcome` + `ErrorBanner`.
Raw `String(err)` dumps stay only as `detail` (support context), never as
the user-facing message.
