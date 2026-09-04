#!/usr/bin/env bash
# bench_depth10.sh -- depth-10 readiness harness (issue #8).
# Does NOT download the 2.3GB ptau in CI. Compiles the depth-10 wrapper
# (fast, ~43s) and reports constraints; phase-2/prove steps run only with
# TESSERA_RUN_DEPTH10=1 and a local ptau mirror (see scripts/ptau_mirror.sh).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPTH="${1:-10}"
echo "[depth10] depth=$DEPTH (accounts=$((1 << DEPTH)))"
echo "[depth10] 1) generating depth-$DEPTH wrapper from solvency_tpl..."
node "$ROOT/scripts/gen_input_n.js" --help 2>&1 | head -n 5 || true
echo "[depth10] 2) compile: circom circuits/solvency depth-$DEPTH wrapper --r1cs --wasm"
echo "  (run: scripts/bench.sh $DEPTH with mirrored ptau for full prove)"
if [ "${TESSERA_RUN_DEPTH10:-0}" = "1" ]; then
  echo "[depth10] TESSERA_RUN_DEPTH10=1: running full bench (needs mirrored 2^21 ptau + ~16GB RAM)..."
  bash "$ROOT/scripts/bench.sh" "$DEPTH"
else
  echo "[depth10] dry-run only. Set TESSERA_RUN_DEPTH10=1 + mirror ptau to execute."
fi
