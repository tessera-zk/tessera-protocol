# Depth-9 stepping stone (issue #39)

## Question

If a 16GB box is unavailable, is depth-9 (512 accounts, 2^20 ptau) a useful
intermediate, or should depth-10 wait for full provisioning?

## Numbers (from `scripts/estimate_depth10.js` calibration)

- Depth-9: ~674k constraints, ptau 2^20 (~1.2GB), prove ~59s extrapolated.
- Preflight on a 12GB box: GO (this machine: NO-GO at 3GB — honest).
- On-chain cost unchanged either way: ~800-byte proof, sub-second verify.

## Decision

- If the provisioned box has ≥16GB: skip depth-9, go straight to depth-10.
  A depth-9 setup is throwaway work (different ptau power, different zkey).
- If only 12GB is available: depth-9 DOUBLES the verified book (256→512)
  for one afternoon of compute. Worth it as a milestone, labeled as such.
- Below 12GB: do neither; run rapidsnark proving experiments at depth-8
  instead (no setup needed — zkeys already exist).

## Rule

Depth-9 artifacts, if ever made, get their own `*_depth9` filenames and log
section. Never overwrite depth-8 or depth-10 records.
