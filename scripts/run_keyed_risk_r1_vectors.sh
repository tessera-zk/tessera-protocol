#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run_keyed_risk_r1_vectors.sh -- R1 witness vectors (issue #66).
# Compiles circuits/keyed_risk_r1.circom, regenerates the 5 deterministic
# vectors, and checks each witness outcome against expectation:
#   V1 distinct-keys .... PASS (witness OK)
#   V2 whale-split ...... FAIL (per-key sum 16000 > 11200 cap)
#   V3 shared-under-cap . PASS (16000 <= 16800 at cap 6000)
#   V4 forged signature . UNPROVABLE (EdDSA assert)
#   V5 thin reserves .... FAIL (28000 < 29400 floor)
# Usage: bash scripts/run_keyed_risk_r1_vectors.sh
# Expect: R1 VECTORS RESULT: pass=5 fail=0
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE=$(which node)
SNARKJS_JS=$(which snarkjs)
SNARKJS="$NODE $SNARKJS_JS"

BUILD_DIR="$ROOT/build/keyed_r1"
mkdir -p "$BUILD_DIR"
echo "==> Compiling keyed_risk_r1.circom"
circom circuits/keyed_risk_r1.circom --r1cs --wasm -o "$BUILD_DIR" | grep -E "constraints|wires" || true
WASM="$BUILD_DIR/keyed_risk_r1_js/keyed_risk_r1.wasm"

echo "==> Generating vectors"
$NODE scripts/gen_keyed_risk_r1.js || exit 1

pass=0; fail=0
expect() { # <tag> <want: ok|fail>
  local tag="$1" want="$2"
  if $SNARKJS wtns calculate "$WASM" "$ROOT/build/inputs/keyed_r1_${tag}.json" "$BUILD_DIR/${tag}.wtns" >/dev/null 2>&1; then
    got="ok"
  else
    got="fail"
  fi
  if [ "$got" = "$want" ]; then echo "R1 $tag: as expected ($got)"; pass=$((pass+1));
  else echo "R1 $tag: UNEXPECTED (want $want, got $got)"; fail=$((fail+1)); fi
}

expect "v1" "ok"
expect "v2" "fail"
expect "v3" "ok"
expect "v4" "fail"
expect "v5" "fail"

echo ""
echo "R1 VECTORS RESULT: pass=$pass fail=$fail"
test "$fail" -eq 0
