#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build_signed.sh  --  Compile + Groth16 phase-2 setup for the FIX-1 rebuilt
# signed_solvency circuit (in-circuit EdDSA, signer keys now PUBLIC), then
# generate the honest + omission witnesses and REAL proofs.
#
# The signed circuit has ~34k non-linear constraints, so it needs the power-16
# BN254 Hermez ptau (the base build.sh uses power 15 for the smaller circuits).
# Single-contributor phase 2 (DISCLOSED non-ceremony; see circuits/README.md).
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
PTAU="$ROOT/ptau/powersOfTau28_hez_final_16.ptau"
IN="$BUILD/inputs"
PROOFS="$BUILD/proofs"
mkdir -p "$BUILD" "$KEYS" "$PROOFS"

echo "==> [1/5] Compile signed_solvency (public signer keys)"
$CIRCOM circuits/signed_solvency.circom --r1cs --wasm --sym -o "$BUILD/"

echo "==> [2/5] Groth16 setup (ptau power 16)"
$SNARKJS groth16 setup "$BUILD/signed_solvency.r1cs" "$PTAU" "$BUILD/signed_solvency_0000.zkey"
$SNARKJS zkey contribute "$BUILD/signed_solvency_0000.zkey" "$BUILD/signed_solvency_final.zkey" \
  --name="tessera-single-contributor" -e="tessera v1 entropy signed_solvency"
$SNARKJS zkey export verificationkey "$BUILD/signed_solvency_final.zkey" "$KEYS/vk_signed_solvency.json"
cp "$BUILD/signed_solvency_final.zkey" "$KEYS/signed_solvency_final.zkey"

echo "==> [3/5] Generate witness inputs"
$NODE scripts/gen_signed_incircuit.js

WASM="$BUILD/signed_solvency_js/signed_solvency.wasm"

echo "==> [4/5] Prove HONEST book"
$SNARKJS wtns calculate "$WASM" "$IN/signed_solvency.json" "$PROOFS/signed_solvency.wtns"
$SNARKJS groth16 prove "$KEYS/signed_solvency_final.zkey" "$PROOFS/signed_solvency.wtns" \
  "$PROOFS/signed_solvency_proof.json" "$PROOFS/signed_solvency_public.json"
$SNARKJS groth16 verify "$KEYS/vk_signed_solvency.json" \
  "$PROOFS/signed_solvency_public.json" "$PROOFS/signed_solvency_proof.json"

echo "==> [5/5] Prove OMISSION book (valid proof, rejected on-chain by key pin)"
$SNARKJS wtns calculate "$WASM" "$IN/signed_solvency_omitted.json" "$PROOFS/signed_solvency_omitted.wtns"
$SNARKJS groth16 prove "$KEYS/signed_solvency_final.zkey" "$PROOFS/signed_solvency_omitted.wtns" \
  "$PROOFS/signed_solvency_omitted_proof.json" "$PROOFS/signed_solvency_omitted_public.json"
$SNARKJS groth16 verify "$KEYS/vk_signed_solvency.json" \
  "$PROOFS/signed_solvency_omitted_public.json" "$PROOFS/signed_solvency_omitted_proof.json"

echo ""
echo "=== HONEST public signals ==="
cat "$PROOFS/signed_solvency_public.json"
echo ""
echo "=== OMITTED public signals ==="
cat "$PROOFS/signed_solvency_omitted_public.json"
echo ""
echo "build_signed.sh DONE"