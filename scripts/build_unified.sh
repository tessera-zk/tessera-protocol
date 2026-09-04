#!/usr/bin/env bash
# build_unified.sh -- compile the unified skeleton (no trusted setup).
# Spec-track only: proves the template compiles; does NOT run phase-2.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT="$ROOT/circuits/unified_solvency.circom"
OUT="$ROOT/build/unified"

echo "[unified] compiling $CIRCUIT"
mkdir -p "$OUT"
circom "$CIRCUIT" --r1cs --wasm --sym -o "$OUT"
echo "[unified] r1cs: $OUT/unified_solvency.r1cs"
echo "[unified] wasm: $OUT/unified_solvency_js/unified_solvency.wasm"
echo "[unified] constraints:"
snarkjs r1cs info "$OUT/unified_solvency.r1cs" | head -n 20
echo "[unified] NOTE: no phase-2 setup run here (NOT-YET #1 skeleton)."
