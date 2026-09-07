#!/usr/bin/env bash
# unified_setup.sh -- real phase-2 for the unified skeleton (issue #36).
# Compiles circuits/unified_solvency.circom, runs Groth16 setup on the 2^16
# Hermez ptau, contributes single-contributor entropy (DISCLOSED, not a
# ceremony), exports circuit-keys/vk_unified_solvency.json, verifies the chain.
# Idempotent: skips steps whose outputs exist. zkey stays in build/ (gitignored).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="$ROOT/build/unified"
KEYS="$ROOT/circuit-keys"
PTAU="$ROOT/ptau/powersOfTau28_hez_final_16.ptau"
mkdir -p "$OUT"
test -f "$PTAU" || { echo "missing $PTAU — run scripts/ptau_mirror.sh 16 first"; exit 1; }

echo "[1/5] compile"
if [ ! -f "$OUT/unified_solvency.r1cs" ]; then
  circom circuits/unified_solvency.circom --r1cs --wasm --sym -o "$OUT"
fi
snarkjs r1cs info "$OUT/unified_solvency.r1cs"

echo "[2/5] groth16 setup"
if [ ! -f "$OUT/unified_0000.zkey" ]; then
  snarkjs groth16 setup "$OUT/unified_solvency.r1cs" "$PTAU" "$OUT/unified_0000.zkey"
fi

echo "[3/5] contribute (single-contributor, DISCLOSED non-ceremony)"
if [ ! -f "$OUT/unified_final.zkey" ]; then
  echo "tessera-unified-local-entropy-$(date -u +%FT%TZ)" | snarkjs zkey contribute "$OUT/unified_0000.zkey" "$OUT/unified_final.zkey" --name="tessera-local-1" -v
fi

echo "[4/5] export verification key"
snarkjs zkey export verificationkey "$OUT/unified_final.zkey" "$KEYS/vk_unified_solvency.json"

echo "[5/5] verify chain"
snarkjs zkey verify "$OUT/unified_solvency.r1cs" "$PTAU" "$OUT/unified_final.zkey"
sha256sum "$OUT/unified_solvency.r1cs" "$OUT/unified_final.zkey" "$KEYS/vk_unified_solvency.json"
echo "DONE: vkey at circuit-keys/vk_unified_solvency.json (zkey stays in build/, untracked)"
