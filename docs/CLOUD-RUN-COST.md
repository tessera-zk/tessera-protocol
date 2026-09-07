# One-shot cloud run cost estimate (issue #39)

Goal: a single depth-10 phase-2 + prove on rented iron, then bring artifacts
home. Numbers are planning-grade (check current pricing before booking).

## Shape of the job

- Fetch 2^21 ptau once (2.3GB, resumable via `scripts/ptau_mirror.sh`).
- `snarkjs groth16 setup` on ~1.35M-constraint r1cs (several minutes).
- One `zkey contribute` (single-contributor — still NOT a ceremony).
- `zkey verify`, export vkey, one honest prove + verify.
- Total active compute: ~1–2 hours; wall-clock with transfers: half a day.

## Instance guidance

- 16 vCPU / 32GB RAM compute box (headroom over the 16GB floor; OOM at this
  stage wastes the whole run).
- 50GB disk (ptau 2.3GB + zkey ~1GB + wasm/scratch + OS).
- Region near the operator for fast artifact download (~2GB home).

## Cost envelope

- Compute: single-digit dollars per hour × ~4 billed hours (setup + buffer).
- Egress: one ~2GB download (usually cents).
- Expected total: **well under $50** for the one-shot. A proving-only box
  afterwards (rapidsnark) is even cheaper and reusable per epoch.

## What NOT to rent

- No GPU needed (Groth16 setup/prove here are CPU jobs at this scale).
- No managed ceremony service — this run stays single-contributor and is
  labeled as such; the MPC ceremony is a separate project (see
  `docs/TRUSTED-SETUP-CEREMONY.md`).
