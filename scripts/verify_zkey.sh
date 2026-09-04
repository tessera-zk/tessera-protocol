#!/usr/bin/env bash
# verify_zkey.sh -- verify a phase-2 zkey against its r1cs + ptau (issue #9).
# Usage: bash scripts/verify_zkey.sh <r1cs> <ptau> <zkey>
set -euo pipefail
R1CS="${1:?usage: verify_zkey.sh <r1cs> <ptau> <zkey>}"
PTAU="${2:?usage: verify_zkey.sh <r1cs> <ptau> <zkey>}"
ZKEY="${3:?usage: verify_zkey.sh <r1cs> <ptau> <zkey>}"
echo "[zkey-verify] r1cs=$R1CS ptau=$PTAU zkey=$ZKEY"
snarkjs zkey verify "$R1CS" "$PTAU" "$ZKEY"
echo "[zkey-verify] OK; record hashes:"
sha256sum "$R1CS" "$PTAU" "$ZKEY"
