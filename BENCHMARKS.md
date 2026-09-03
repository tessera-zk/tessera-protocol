# Tessera — scale benchmarks

Real measurements of the `solvency` circuit (Merkle-sum tree, BN254, circomlib Poseidon, Groth16) as the account count grows. The `Solvency` template lives in `circuits/lib/solvency_tpl.circom` and is instantiated at any depth by the benchmark harness (`scripts/bench.sh` + `scripts/gen_input_n.js`); `circuits/solvency.circom` is the depth-4 demo. Public-signal order is identical at every depth, so the deployed Soroban verifier is unaffected.

Machine: local (Apple Silicon). Groth16 phase-1 = public Hermez BN254 ptau; phase-2 = single-contributor (not a production ceremony).

| depth | accounts | constraints | ptau | zkey | compile | phase-2 setup | prove | verify | proof size | verifies |
|------:|---------:|------------:|-----:|-----:|--------:|--------------:|------:|-------:|-----------:|:--------:|
| 4  | 16      | 20,511    | 2^15 (37 MB)  | small  | ~1 s   | seconds  | ~1 s   | <1 s | ~800 B | yes |
| 8  | 256     | 337,079   | 2^19 (576 MB) | 148 MB | 15.2 s | 358.7 s | 29.3 s | 0.98 s | 806 B | yes |
| 10 | 1,024   | 1,350,075 | 2^21 (2.3 GB) | —      | 42.7 s | — | — | — | — | blocked |

Key facts:
- Groth16 proof size stays **constant (~800 bytes)** and verify stays **sub-second** regardless of account count — the on-chain verification cost does not grow with the book size. That is the property that makes this viable for a real issuer.
- Constraints grow roughly linearly with leaf count (Poseidon-dominated): ~1.3k constraints/account at these depths.
- **Honest wall at depth 10:** the phase-1 ptau for 2^21 constraints is a 2.3 GB download; the fetch reset partway (`Connection reset by peer`) and phase-2 setup at that size is memory-heavy. Depth 8 (256 accounts) is the largest we fully proved and verified here. Reaching 2^20+ accounts in production is a provisioning problem (host a local ptau mirror, more RAM, or a rapidsnark prover), not a circuit problem — the circuit is depth-parametric and unchanged.

Reproduce: `scripts/bench.sh <depth>` (uses the absolute node/snarkjs paths; downloads the matching Hermez ptau).