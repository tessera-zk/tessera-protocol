# Depth-10 (1,024-account) provisioning plan (issue #8)

Status: **plan + harness. Depth-10 proving itself is NOT-YET.**

Wall (honest, from BENCHMARKS.md): the 2^21 Hermez ptau is a 2.3GB download
that reset partway (`Connection reset by peer`); phase-2 at that size is
memory-heavy. Not a circuit problem — the `Solvency` template is
depth-parametric and unchanged.

## Path

1. Mirror the ptau once: `bash scripts/ptau_mirror.sh 21 ~/.tessera-ptau`
   (resumable `curl -C -`, avoids re-hitting the public drop).
2. Estimate: `node scripts/estimate_depth10.js` → depth-10 ≈ 1.35M
   constraints, ptau 2^21, prove ~2min (extrapolated from depth-8 29.3s).
3. Dry-run harness: `bash scripts/bench_depth10.sh 10` (compile only).
4. Full run (provisioned host, ~16GB RAM):
   `TESSERA_RUN_DEPTH10=1 bash scripts/bench_depth10.sh 10`.
5. Alternatives if provisioned host unavailable: local ptau mirror on LAN,
   more RAM, or `rapidsnark` prover (all NOT-YET, listed in MEMORY doc).

## CI rule

CI never fetches 2^21. Depth-10 steps run only with `TESSERA_RUN_DEPTH10=1`
plus a pre-mirrored ptau. Depth-4/8 stay the verified scale claims.
