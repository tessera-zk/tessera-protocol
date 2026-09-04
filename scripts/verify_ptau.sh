#!/usr/bin/env bash
# verify_ptau.sh -- check a Hermez ptau hash before use (issue #9).
# Usage: bash scripts/verify_ptau.sh <ptau-file> [expected-sha256]
set -euo pipefail
FILE="${1:?usage: verify_ptau.sh <ptau-file> [expected-sha256]}"
EXPECTED="${2:-}"
echo "[ptau-verify] file: $FILE"
ls -lh "$FILE"
ACTUAL="$(sha256sum "$FILE" | awk '{print $1}')"
echo "[ptau-verify] sha256: $ACTUAL"
if [ -n "$EXPECTED" ]; then
  if [ "$ACTUAL" = "$EXPECTED" ]; then echo "[ptau-verify] MATCH"; else echo "[ptau-verify] MISMATCH (expected $EXPECTED)" >&2; exit 1; fi
else
  echo "[ptau-verify] no expected hash given; record this value in docs/SETUP-REPRODUCIBILITY.md"
fi
