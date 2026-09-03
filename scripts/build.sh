#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build.sh  --  Compile circuits, fetch a BN254 powers-of-tau, run the Groth16
# phase-2 setup (single contributor, DISCLOSED as NOT production-safe), and
# export verification keys. Idempotent: re-running skips finished steps.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Toolchain - use PATH-resolved binaries for CI portability
CIRCOM=$(which circom)
NODE=$(which node)
SNARKJS_JS=$(which snarkjs)
SNARKJS="$NODE $SNARKJS_JS"

BUILD="$ROOT/build"
KEYS="$ROOT/circuit-keys"
PTAU_DIR="$ROOT/ptau"
mkdir -p "$BUILD" "$KEYS" "$PTAU_DIR"

# Powers of tau: solvency has ~20.5k constraints (needs 2^15=32768), inclusion
# ~3.5k (needs 2^12). We use one shared BN254 Hermez phase-1 ceremony of power
# 15, which covers both circuits. This is the smallest Hermez ptau that fits
# the larger (solvency) circuit.
PTAU_POWER=15
PTAU_FILE="$PTAU_DIR/powersOfTau28_hez_final_${PTAU_POWER}.ptau"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_${PTAU_POWER}.ptau"

echo "==> [1/4] Compiling circuits (BN254, circom $($CIRCOM --version | awk '{print $3}'))"
$CIRCOM circuits/solvency.circom  --r1cs --wasm --sym -o "$BUILD/"
$CIRCOM circuits/inclusion.circom --r1cs --wasm --sym -o "$BUILD/"

echo "==> [2/4] Powers of tau (BN254 Hermez, public phase-1)"
if [ ! -f "$PTAU_FILE" ]; then
  echo "    downloading $PTAU_URL"
  curl -L --fail -o "$PTAU_FILE" "$PTAU_URL"
else
  echo "    reusing $PTAU_FILE"
fi

# ---------------------------------------------------------------------------
# groth16_setup <name>: phase-2 setup + vk export for build/<name>.r1cs
# Single-contributor phase 2. The random beacon / single contribution below is
# a HACKATHON setup, NOT a multi-party ceremony. See circuits/README.md.
# ---------------------------------------------------------------------------
groth16_setup () {
  local name="$1"
  echo "==> setup: $name"
  $SNARKJS groth16 setup "$BUILD/${name}.r1cs" "$PTAU_FILE" "$BUILD/${name}_0000.zkey"
  # Single contribution (disclosed non-ceremony). Entropy is supplied inline so
  # the build is reproducible for the demo; a real deployment needs an MPC.
  $SNARKJS zkey contribute "$BUILD/${name}_0000.zkey" "$BUILD/${name}_final.zkey" \
    --name="tessera-single-contributor" -e="tessera v1 entropy ${name}"
  $SNARKJS zkey export verificationkey "$BUILD/${name}_final.zkey" "$KEYS/vk_${name}.json"
  cp "$BUILD/${name}_final.zkey" "$KEYS/${name}_final.zkey"
}

echo "==> [3/4] Groth16 phase-2 setup + verification keys"
groth16_setup solvency
groth16_setup inclusion

echo "==> [4/4] Done. Artifacts:"
echo "    wasm : $BUILD/solvency_js/solvency.wasm , $BUILD/inclusion_js/inclusion.wasm"
echo "    zkey : $KEYS/solvency_final.zkey , $KEYS/inclusion_final.zkey"
echo "    vkey : $KEYS/vk_solvency.json , $KEYS/vk_inclusion.json"