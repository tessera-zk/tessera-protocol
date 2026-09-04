# Per-member concentration via keyed leaves (issue #11)

Status: **spec + prototype template. NOT deployed. Per-LEAF remains the
enforced claim (FIX 3).**

FIX 3 honest scope: `risk_solvency` proves `balance_i * 10000 <=
maxConcBps * total` per LEAF. Leaves are not bound to registered keys, so a
whale splitting across leaves evades the cap. Sound per-member needs FIX 1's
keyed leaves (one keyed leaf per registered member, keys pinned on-chain)
merged into the risk circuit.

## Design (prototype in `circuits/lib/keyed_risk_tpl.circom`)

- Leaves keyed: `acctCommit_i = Poseidon(Ax_i, Ay_i, nonce_i)`,
  `leaf.hash = Poseidon(acctCommit_i, balance_i)`.
- Signer keys `(Ax_i, Ay_i)` PUBLIC (same pin pattern as `signed_solvency`).
- Concentration checked per POSITION (= per registered member once the
  contract pins positions to `register_customer_key` order):
  `balance_i * 10000 <= maxConcBps * total`.
- One position per member enforced by the on-chain pin (no split across two
  positions without two registered keys — a Sybil registration question,
  documented below, not solved here).

## Sybil note (honest)

Per-member caps assume one registered key per real member. If one human
registers two keys, they can still split. Closing that needs identity /
registration policy (NOT-YET, see `docs/KEYED-RISK-AUDIT-NOTES.md`), not just
a circuit. This PR does not overclaim: prototype shows the mechanism; the
Sybil + audit + deploy track remains open.

## Files

- `circuits/lib/keyed_risk_tpl.circom` — prototype (compilable shape).
- `scripts/gen_keyed_risk_input.js`, `scripts/check_keyed_risk.js`.
- `docs/KEYED-RISK-TESTVECTORS.md`, `docs/KEYED-RISK-AUDIT-NOTES.md`.
