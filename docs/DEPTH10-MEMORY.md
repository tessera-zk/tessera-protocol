# Depth-10 memory + provisioning notes (issue #8)

Measured (BENCHMARKS.md, Apple Silicon):

| depth | accounts | constraints | ptau | prove |
|---|---|---|---|---|
| 4 | 16 | 20,511 | 2^15 (37MB) | ~1s |
| 8 | 256 | 337,079 | 2^19 (576MB) | 29.3s |
| 10 | 1024 | ~1,350,075 | 2^21 (2.3GB) | blocked |

Guidance for the provisioned host:

- Disk: 10GB free (2.3GB ptau + zkey + wasm + build scratch).
- RAM: 16GB minimum for `snarkjs zkey new` at 2^21; 32GB comfortable.
- Network: resumable fetch (`curl -C - --retry 5` in `ptau_mirror.sh`); keep a
  LAN mirror so CI/contributors never re-download.
- Time: compile ~43s, phase-2 several minutes, prove ~2min (extrapolated).
- Fallbacks: `rapidsnark` (C++ prover, lower memory), split phase-2 on a
  bigger box then copy the `.zkey` down, or stay at depth-8 (256 accounts,
  fully verified, constant 806-byte proof, 0.98s on-chain verify).

On-chain cost does NOT grow: Groth16 proof stays ~800 bytes, verify stays
sub-second regardless of depth. Depth-10 is an off-chain provisioning task.
