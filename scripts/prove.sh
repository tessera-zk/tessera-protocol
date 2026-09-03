#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# prove.sh  --  Generate real Groth16 proofs and VERIFY them, plus two NEGATIVE
# tests that must FAIL (underfunded book, and a smuggled negative commitment).
#
# Depends on build.sh having produced build/*_js/*.wasm and circuit-keys/*.zkey.
# Regenerates inputs via gen_input.js so the tree always matches the circuit.
# ---------------------------------------------------------------------------
set -uo pipefail   # NOTE: no -e; we intentionally run commands expected to fail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Toolchain - use PATH-resolved binaries for CI portability
NODE=$(which node)
SNARKJS_JS=$(which snarkjs)
SNARKJS="$NODE $SNARKJS_JS"

BUILD="$ROOT/build"
KEYS="$ROOT/circuit-keys"
IN="$BUILD/inputs"
PROOFS="$BUILD/proofs"
mkdir -p "$PROOFS"

echo "==> Regenerating Merkle-sum inputs"
$NODE scripts/gen_input.js

pass=0
fail=0

# prove_ok <circuit> <input.json> : witness -> proof -> verify, expect OK
prove_ok () {
  local circ="$1" input="$2"
  echo ""
  echo "==================================================================="
  echo "POSITIVE: $circ  ($input)  -- expect proof to VERIFY"
  echo "==================================================================="
  local wasm="$BUILD/${circ}_js/${circ}.wasm"
  local zkey="$KEYS/${circ}_final.zkey"
  local wtns="$PROOFS/${circ}.wtns"
  local proof="$PROOFS/${circ}_proof.json"
  local pub="$PROOFS/${circ}_public.json"

  $SNARKJS wtns calculate "$wasm" "$IN/$input" "$wtns" || { echo "FAIL: witness"; fail=$((fail+1)); return; }
  $SNARKJS groth16 prove "$zkey" "$wtns" "$proof" "$pub" || { echo "FAIL: prove"; fail=$((fail+1)); return; }
  echo "--- public signals ($pub) ---"
  cat "$pub"
  echo ""
  if $SNARKJS groth16 verify "$KEYS/vk_${circ}.json" "$pub" "$proof"; then
    echo "RESULT: VERIFIED OK"
    pass=$((pass+1))
  else
    echo "RESULT: verification FAILED (unexpected)"
    fail=$((fail+1))
  fi
}

# prove_reject <circuit> <input.json> <why> : expect witness/proof to FAIL
prove_reject () {
  local circ="$1" input="$2" why="$3"
  echo ""
  echo "==================================================================="
  echo "NEGATIVE: $circ  ($input)  -- expect REJECTION: $why"
  echo "==================================================================="
  local wasm="$BUILD/${circ}_js/${circ}.wasm"
  local wtns="$PROOFS/${circ}_bad.wtns"
  # A violated constraint makes snarkjs abort during witness calculation.
  if $SNARKJS wtns calculate "$wasm" "$IN/$input" "$wtns" 2>&1; then
    echo "RESULT: circuit ACCEPTED bad input (SECURITY FAILURE)"
    fail=$((fail+1))
  else
    echo "RESULT: circuit REJECTED as expected (constraint unsatisfiable)"
    pass=$((pass+1))
  fi
}

# ---- positive proofs ----
prove_ok solvency  solvency_input.json
prove_ok inclusion inclusion_input.json

# ---- negative tests ----
prove_reject solvency solvency_insolvent.json  "totalLiabilities > reserves (underfunded)"
prove_reject solvency solvency_negbalance.json "leaf commitment is field-negative (out of [0,2^64))"

echo ""
echo "==================================================================="
echo "SUMMARY: pass=$pass fail=$fail"
echo "==================================================================="
[ "$fail" -eq 0 ] || exit 1