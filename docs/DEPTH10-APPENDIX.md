# Depth-10 appendix — what stays true at 1,024 accounts (issue #8)

- Public-signal order identical at every depth, so the deployed Soroban
  verifier is unaffected by depth changes.
- Proof size constant (~800 bytes), on-chain verify sub-second (depth-8:
  806 bytes, 0.98s). Depth-10 inherits both (Groth16 property).
- Constraints grow ~1.3k/account (Poseidon-dominated): depth-10 ≈ 1.35M.
- Reproduce when provisioned: `scripts/bench.sh 10` with mirrored 2^21 ptau
  (see `docs/DEPTH10-PLAN.md`). Until then depth-8 (256) is the largest
  fully proved + verified point, stated everywhere without overclaim.
