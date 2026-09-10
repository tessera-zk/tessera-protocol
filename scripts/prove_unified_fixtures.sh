#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# prove_unified_fixtures.sh -- contract-fixture proofs for #57.
#
# Proves the two EXTRA unified variants the contract tests need (the epoch-0
# honest proof already exists from scripts/prove_unified_positive.sh):
#   * unified_positive_e1.json  (epoch 1, distinct root, same keys) — for the
#     #14 stale-epoch test (submit e1, then stale e0 must panic StaleEpoch)
#   * unified_omitted.json      (valid proof, issuer filler key at slot 2) —
#     for the #10 omission test (proof verifies, key pin rejects)
# Verifies all three against circuit-keys/vk_unified_solvency.json.
#
# Usage: bash scripts/prove_unified_fixtures.sh
# Expect: UNIFIED FIXTURES RESULT: pass=3 fail=0
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE=$(which node)
SNARKJS_JS=$(which snarkjs)
SNARKJS="$NODE $SNARKJS_JS"

WASM="$ROOT/build/unified/unified_solvency_js/unified_solvency.wasm"
ZKEY="$ROOT/build/unified/unified_final.zkey"
VK="$ROOT/circuit-keys/vk_unified_solvency.json"
IN="$ROOT/build/inputs"
PROOFS="$ROOT/build/proofs"
mkdir -p "$PROOFS"

for f in "$WASM" "$ZKEY" "$VK"; do
  test -f "$f" || { echo "missing $f"; exit 1; }
done

pass=0; fail=0

prove_and_verify () { # <tag> <input>
  local tag="$1" input="$2"
  local wtns="$PROOFS/unified_${tag}.wtns"
  local proof="$PROOFS/unified_${tag}_proof.json"
  local pub="$PROOFS/unified_${tag}_public.json"
  echo "--- $tag ($input) ---"
  if $SNARKJS wtns calculate "$WASM" "$IN/$input" "$wtns" \
    && $SNARKJS groth16 prove "$ZKEY" "$wtns" "$proof" "$pub" \
    && $SNARKJS groth16 verify "$VK" "$pub" "$proof"; then
    echo "OK: $tag verified"; pass=$((pass+1))
  else
    echo "FAIL: $tag"; fail=$((fail+1))
  fi
}

echo "==> Regenerating fixture inputs"
$NODE scripts/gen_unified_positive.js || exit 1
UNIFIED_EPOCH=1 $NODE scripts/gen_unified_positive.js || exit 1

# Epoch-0 honest re-verified (idempotent — same deterministic proof).
prove_and_verify "pos" "unified_positive.json"
prove_and_verify "pos_e1" "unified_positive_e1.json"
prove_and_verify "omitted" "unified_omitted.json"

echo ""
echo "UNIFIED FIXTURES RESULT: pass=$pass fail=$fail"
test "$fail" -eq 0
