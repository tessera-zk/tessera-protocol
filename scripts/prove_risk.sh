#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# prove_risk.sh  --  UPGRADE 3: prove a healthy book VERIFIES, and prove a
# concentration-breach book and an under-collateralized book are UNPROVABLE
# (witness calculation aborts on an unsatisfiable constraint -> no proof exists).
#
# Depends on: circuits compiled + circuit-keys/risk_solvency_final.zkey, and
# scripts/gen_risk_input.js having emitted build/inputs/risk_solvency*.json.
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NODE=$(which node)
SNARKJS_JS=$(which snarkjs)
SNARKJS="$NODE $SNARKJS_JS"
KEYS="$ROOT/circuit-keys"
IN="$ROOT/build/inputs"
PROOFS="$ROOT/build/proofs"
WASM="$ROOT/build/risk_solvency_js/risk_solvency.wasm"
mkdir -p "$PROOFS"

echo "==> Regenerating risk inputs"
$NODE scripts/gen_risk_input.js

pass=0; fail=0

echo ""
echo "POSITIVE: healthy diversified over-collateralized book -- expect VERIFY"
if $SNARKJS wtns calculate "$WASM" "$IN/risk_solvency.json" "$PROOFS/risk.wtns" \
   && $SNARKJS groth16 prove "$KEYS/risk_solvency_final.zkey" "$PROOFS/risk.wtns" \
        "$PROOFS/risk_solvency_proof.json" "$PROOFS/risk_solvency_public.json" \
   && $SNARKJS groth16 verify "$KEYS/vk_risk_solvency.json" \
        "$PROOFS/risk_solvency_public.json" "$PROOFS/risk_solvency_proof.json"; then
  echo "RESULT: VERIFIED OK"; pass=$((pass+1))
else
  echo "RESULT: FAILED (unexpected)"; fail=$((fail+1))
fi

reject () { # <label> <input> <why>
  echo ""
  echo "NEGATIVE: $1 -- expect UNPROVABLE ($3)"
  if $SNARKJS wtns calculate "$WASM" "$IN/$2" "$PROOFS/bad.wtns" 2>&1; then
    echo "RESULT: circuit ACCEPTED bad book (SECURITY FAILURE)"; fail=$((fail+1))
  else
    echo "RESULT: REJECTED (constraint unsatisfiable -> no proof exists)"; pass=$((pass+1))
  fi
}

reject "concentration breach (whale = 60% > 40% cap)" risk_solvency_concentrated.json "concentration cap"
reject "under-collateralized (102% < 105% min)" risk_solvency_undercoll.json "min collateralization"

echo ""
echo "RISK SUMMARY: pass=$pass fail=$fail"
[ "$fail" -eq 0 ] || exit 1