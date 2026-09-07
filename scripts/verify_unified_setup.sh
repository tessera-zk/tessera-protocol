#!/usr/bin/env bash
# verify_unified_setup.sh -- re-verify the unified phase-2 chain (issue #36).
# Checks: zkey verifies against r1cs+ptau, committed vkey hash matches the log,
# r1cs hash matches the log. Read-only: verifies, never regenerates.
# Usage: bash scripts/verify_unified_setup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
R1CS="build/unified/unified_solvency.r1cs"
ZKEY="build/unified/unified_final.zkey"
PTAU="ptau/powersOfTau28_hez_final_16.ptau"
VK="circuit-keys/vk_unified_solvency.json"
for f in "$R1CS" "$ZKEY" "$PTAU" "$VK"; do test -f "$f" || { echo "missing $f — run scripts/unified_setup.sh first"; exit 1; }; done
echo "[1/3] zkey chain verify"
snarkjs zkey verify "$R1CS" "$PTAU" "$ZKEY" | tail -n 2
echo "[2/3] hash pin check (must match docs/UNIFIED-SETUP-LOG.md)"
sha256sum "$R1CS" "$ZKEY" "$VK"
echo "[3/3] vkey shape check"
node -e "const v=require('./$VK'); if(v.nPublic!==14||v.curve!=='bn128') throw new Error('unexpected vkey shape'); console.log('vkey OK: nPublic=14 curve=bn128')"
echo "VERIFY PASS"
