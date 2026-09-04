#!/usr/bin/env bash
# ptau_mirror.sh -- provision a local Hermez ptau mirror (issue #8).
# Avoids re-hitting the public Hermez drop (which reset partway at 2.3GB).
# Usage: bash scripts/ptau_mirror.sh [POWER] [MIRROR_DIR]
#   POWER: 15,16,19,21 (default 19 = depth-8). 21 = depth-10 (2.3GB, NOT fetched in CI).
set -euo pipefail
POWER="${1:-19}"
MIRROR_DIR="${2:-$HOME/.tessera-ptau}"
mkdir -p "$MIRROR_DIR" ptau
names() {
  case "$1" in
    15) echo "powersOfTau28_hez_final_15.ptau" ;;
    16) echo "powersOfTau28_hez_final_16.ptau" ;;
    19) echo "powersOfTau28_hez_final_19.ptau" ;;
    21) echo "powersOfTau28_hez_final_21.ptau" ;;
    *) echo "unsupported power: $1 (use 15/16/19/21)" >&2; exit 1 ;;
  esac
}
FILE="$(names "$POWER")"
URL="https://storage.googleapis.com/zkevm/ptau/$FILE"
echo "[ptau] power=2^$POWER file=$FILE mirror=$MIRROR_DIR"
if [ -f "$MIRROR_DIR/$FILE" ]; then echo "[ptau] mirror hit: $MIRROR_DIR/$FILE"; else echo "[ptau] fetching $URL"; curl -C - -L --retry 5 -o "$MIRROR_DIR/$FILE" "$URL"; fi
echo "[ptau] verifying (size + snarkjs check)..."
ls -lh "$MIRROR_DIR/$FILE"
ln -sf "$MIRROR_DIR/$FILE" "ptau/$FILE"
echo "[ptau] linked: ptau/$FILE"
if [ "$POWER" = "21" ]; then echo "[ptau] NOTE: 2^21 is ~2.3GB; needs ~16GB RAM for phase-2 (see docs/DEPTH10-MEMORY.md)."; fi
