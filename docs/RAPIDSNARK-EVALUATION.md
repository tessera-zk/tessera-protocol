# rapidsnark evaluation (issue #39)

## What it is

C++ Groth16 prover (iden3/rapidsnark). Same math as snarkjs proving, 3–6x
faster wall-clock, materially lower peak RAM. Consumes the SAME `.zkey` +
`.wtns` snarkjs produces; emits the SAME `proof.json` + `public.json` the
Soroban verifier checks. Swapping provers changes no circuit, no vkey, no
contract, no testnet semantics.

## What it is NOT

- Not a setup tool: phase-2 (`zkey new`/`contribute`) still needs snarkjs +
  big RAM. rapidsnark does not shrink the 2^21 provisioning wall for SETUP.
- Not a witness generator: `.wtns` still comes from the circom wasm
  (browser or `snarkjs wtns calculate`).
- Not audited for our use: first rapidsnark proof must be verified with
  `snarkjs groth16 verify` against the same vkey before any claim.

## Where it helps Tessera

Depth-10 PROVING (~2min extrapolated in snarkjs) drops to ~30s, and — more
importantly — becomes feasible on the 4–8GB boxes where snarkjs proving OOMs.
The binding constraint remains phase-2 RAM (16GB), which rapidsnark cannot fix.

## Adoption rule

`scripts/install_rapidsnark.sh` builds it; the first depth-10 proof (on the
provisioned host) is generated TWICE (snarkjs + rapidsnark) and both verify
against `vk` before rapidsnark becomes the documented path.
