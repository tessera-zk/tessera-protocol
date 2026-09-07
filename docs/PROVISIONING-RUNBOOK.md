# Provisioning runbook — depth-10 on a provisioned host (issue #39)

Precondition: `node scripts/provision_preflight.js --depth=10` prints GO on
the target box. This machine prints NO-GO (3GB < 16GB) — do not attempt here.

## Sequence

1. Mirror ptau: `bash scripts/ptau_mirror.sh 21 ~/.tessera-ptau` (resumable;
   verify sha256 per `docs/SETUP-REPRODUCIBILITY.md`).
2. Re-run preflight to confirm still GO after the download (disk check).
3. Generate depth-10 wrapper + input: `scripts/bench.sh 10` compile stage, or
   the depth-N generator (`scripts/gen_input_n.js`).
4. Phase-2: `snarkjs groth16 setup` + ONE disclosed `zkey contribute`.
5. `snarkjs zkey verify` + record ALL hashes in the reproducibility record.
6. Honest prove + `snarkjs groth16 verify` sanity; optionally repeat the prove
   with rapidsnark (`scripts/install_rapidsnark.sh`) and compare.
7. Bring home: `.zkey`, `verification_key.json`, hashes, timings. Large files
   travel out-of-band; hashes travel in the docs PR.
8. Docs PR: new `BENCHMARKS.md` depth-10 row with measured (not extrapolated)
   numbers; depth-10 graduates from NOT-YET to verified.

## CI rule (unchanged)

No part of this sequence runs in CI. CI never fetches 2^21.
