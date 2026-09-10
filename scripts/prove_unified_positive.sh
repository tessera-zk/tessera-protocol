#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# prove_unified_positive.sh -- POSITIVE CONTROL for the unified circuit (#55).
#
# Regenerates the deterministic positive-control input, builds the witness with
# the compiled unified wasm, proves with the REAL 2^16 phase-2 zkey (#36), and
# verifies against circuit-keys/vk_unified_solvency.json. Asserts the 14-signal
# public order [rootHash, totalLiabilities, reserves, epoch,
# Ax[0..3], Ay[0..3], maxConcBps, minCollBps].
#
# Usage: bash scripts/prove_unified_positive.sh
# Expect: UNIFIED POSITIVE RESULT: pass=2 fail=0
#   (positive verifies; tampered-signature negative is UNPROVABLE)
# ---------------------------------------------------------------------------
set -uo pipefail   # no -e: the negative case is expected to fail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE=$(which node)
SNARKJS_JS=$(which snarkjs)
SNARKJS="$NODE $SNARKJS_JS"

WASM="$ROOT/build/unified/unified_solvency_js/unified_solvency.wasm"
ZKEY="$ROOT/build/unified/unified_final.zkey"
VK="$ROOT/circuit-keys/vk_unified_solvency.json"
IN="$ROOT/build/inputs/unified_positive.json"
PROOFS="$ROOT/build/proofs"
mkdir -p "$PROOFS"

for f in "$WASM" "$ZKEY" "$VK"; do
  test -f "$f" || { echo "missing $f — run scripts/build_unified.sh + scripts/unified_setup.sh first"; exit 1; }
done

pass=0; fail=0

echo "==> Regenerating deterministic positive-control input"
$NODE scripts/gen_unified_positive.js || { echo "FAIL input generation"; exit 1; }

echo ""
echo "=================================================================="
echo "POSITIVE: unified honest book (4 real sigs) -- expect VERIFY"
echo "=================================================================="
WTNS="$PROOFS/unified_pos.wtns"
PROOF="$PROOFS/unified_pos_proof.json"
PUB="$PROOFS/unified_pos_public.json"
if $SNARKJS wtns calculate "$WASM" "$IN" "$WTNS"; then
  if $SNARKJS groth16 prove "$ZKEY" "$WTNS" "$PROOF" "$PUB"; then
    echo "--- public signals ($PUB) ---"; cat "$PUB"; echo ""
    $NODE -e "
      const pub = require('$PUB');
      if (pub.length !== 14) throw new Error('expected 14 public signals, got ' + pub.length);
      const art = require('./contracts/artifacts/unified-positive.json');
      if (pub[0] !== art.rootHash_dec) throw new Error('signal[0] root mismatch');
      if (pub[1] !== art.totalLiabilities) throw new Error('signal[1] total mismatch');
      if (pub[2] !== art.reserves) throw new Error('signal[2] reserves mismatch');
      if (pub[3] !== art.epoch) throw new Error('signal[3] epoch mismatch');
      art.members.forEach((m, i) => {
        if (pub[4 + i] !== m.Ax_dec) throw new Error('Ax[' + i + '] mismatch');
        if (pub[8 + i] !== m.Ay_dec) throw new Error('Ay[' + i + '] mismatch');
      });
      if (pub[12] !== art.maxConcBps) throw new Error('maxConcBps mismatch');
      if (pub[13] !== art.minCollBps) throw new Error('minCollBps mismatch');
      console.log('signal order OK: [root,total,reserves,epoch,Ax[0..3],Ay[0..3],maxConc,minColl]');
    " || { echo "FAIL signal-order check"; fail=$((fail+1)); }
    if $SNARKJS groth16 verify "$VK" "$PUB" "$PROOF"; then
      echo "RESULT: VERIFIED OK"; pass=$((pass+1))
    else
      echo "RESULT: verification FAILED (unexpected)"; fail=$((fail+1))
    fi
  else
    echo "FAIL prove"; fail=$((fail+1))
  fi
else
  echo "FAIL witness"; fail=$((fail+1))
fi

echo ""
echo "=================================================================="
echo "NEGATIVE: forged signature (S bit flipped) -- expect UNPROVABLE"
echo "=================================================================="
FORGED_IN="$PROOFS/unified_forged_input.json"
$NODE -e "
  const fs = require('fs');
  const inp = require('$IN');
  const out = JSON.parse(JSON.stringify(inp));
  out.S[2] = (BigInt(out.S[2]) ^ 1n).toString();
  fs.writeFileSync('$FORGED_IN', JSON.stringify(out));
"
if $SNARKJS wtns calculate "$WASM" "$FORGED_IN" "$PROOFS/unified_neg.wtns" 2>/dev/null; then
  echo "RESULT: witness SUCCEEDED (unexpected — forgery provable!)"; fail=$((fail+1))
else
  echo "RESULT: witness correctly UNPROVABLE (EdDSA constraint rejects forgery)"; pass=$((pass+1))
fi

echo ""
echo "UNIFIED POSITIVE RESULT: pass=$pass fail=$fail"
test "$fail" -eq 0
