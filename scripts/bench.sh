#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# bench.sh DEPTH  --  Scale benchmark for the solvency circuit at a given depth.
# Generates a depth-N wrapper circuit, compiles it, runs the Groth16 phase-2
# setup against the smallest fitting Hermez ptau, proves a REAL solvency proof
# over 2^DEPTH accounts, verifies it, and records real numbers (constraints,
# proving time, proof size, verify time, ptau size) to logs/bench_dN.json.
#
# Honest: every number is measured, nothing hardcoded. If setup/prove OOMs or
# fails, the failure is recorded and the script exits non-zero.
#
# Usage: bash scripts/bench.sh 10
# ---------------------------------------------------------------------------
set -uo pipefail

DEPTH="${1:?usage: bench.sh DEPTH}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Toolchain - use PATH-resolved binaries for CI portability
CIRCOM=$(which circom)
NODE=$(which node)
SNARKJS_JS=$(which snarkjs)
SNARKJS="$NODE $SNARKJS_JS"
# snarkjs is memory-heavy; give node a large old-space so big depths don't
# false-OOM before hitting the real ceiling.
export NODE_OPTIONS="--max-old-space-size=13000"

BUILD="$ROOT/build/bench_d${DEPTH}"
KEYS="$ROOT/build/bench_d${DEPTH}/keys"
PTAU_DIR="$ROOT/ptau"
IN="$ROOT/build/inputs"
LOGS="$ROOT/logs"
mkdir -p "$BUILD" "$KEYS" "$PTAU_DIR" "$IN" "$LOGS"

now_ms() { $NODE -e 'process.stdout.write(String(Date.now()))'; }
say() { echo "==> [d${DEPTH}] $*"; }

# --- 1. generate depth-N wrapper circuit ---
WRAP="$BUILD/solvency_d${DEPTH}.circom"
cat > "$WRAP" <<EOF
pragma circom 2.2.3;
include "$ROOT/circuits/lib/solvency_tpl.circom";
component main { public [rootHash, totalLiabilities, reserves] } = Solvency(${DEPTH}, 64);
EOF

# --- 2. compile ---
say "compiling (2^${DEPTH} accounts)"
T=$(now_ms)
$CIRCOM "$WRAP" --r1cs --wasm --sym -o "$BUILD/" >/dev/null 2>"$BUILD/compile.err" || {
  echo "COMPILE FAILED"; cat "$BUILD/compile.err"; exit 2; }
COMPILE_MS=$(( $(now_ms) - T ))

R1CS="$BUILD/solvency_d${DEPTH}.r1cs"
CONSTRAINTS=$($SNARKJS r1cs info "$R1CS" 2>/dev/null | sed $'s/\x1b\\[[0-9;]*m//g' | grep "# of Constraints" | grep -oE '[0-9]+' | tail -1)
say "constraints=$CONSTRAINTS compile_ms=$COMPILE_MS"

# --- 3. pick smallest fitting ptau power ---
POWER=1
while [ $(( 1 << POWER )) -lt "$CONSTRAINTS" ]; do POWER=$((POWER+1)); done
[ "$POWER" -lt 8 ] && POWER=8
PTAU_FILE="$PTAU_DIR/powersOfTau28_hez_final_${POWER}.ptau"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_${POWER}.ptau"
if [ ! -f "$PTAU_FILE" ]; then
  say "downloading ptau 2^${POWER}"
  curl -L --fail -o "$PTAU_FILE" "$PTAU_URL" 2>"$BUILD/ptau.err" || {
    echo "PTAU DOWNLOAD FAILED (power=$POWER)"; cat "$BUILD/ptau.err"; exit 3; }
fi
PTAU_BYTES=$(stat -f%z "$PTAU_FILE")

# --- 4. groth16 phase-2 setup (single contributor) ---
say "groth16 setup (ptau 2^${POWER}, $((PTAU_BYTES/1024/1024)) MB)"
T=$(now_ms)
$SNARKJS groth16 setup "$R1CS" "$PTAU_FILE" "$BUILD/sol_0000.zkey" >"$BUILD/setup.log" 2>&1 || {
  echo "SETUP FAILED (likely OOM at 2^${POWER})"; tail -5 "$BUILD/setup.log"; exit 4; }
$SNARKJS zkey contribute "$BUILD/sol_0000.zkey" "$KEYS/sol_final.zkey" \
  --name="tessera-bench-d${DEPTH}" -e="tessera v1 bench depth ${DEPTH}" >>"$BUILD/setup.log" 2>&1 || {
  echo "CONTRIBUTE FAILED"; tail -5 "$BUILD/setup.log"; exit 4; }
$SNARKJS zkey export verificationkey "$KEYS/sol_final.zkey" "$KEYS/vk.json" >>"$BUILD/setup.log" 2>&1
SETUP_MS=$(( $(now_ms) - T ))
ZKEY_BYTES=$(stat -f%z "$KEYS/sol_final.zkey")
say "setup_ms=$SETUP_MS zkey=$((ZKEY_BYTES/1024/1024)) MB"

# --- 5. inputs ---
say "generating $((1<<DEPTH)) real balances"
DEPTH=$DEPTH $NODE scripts/gen_input_n.js >"$BUILD/gen.log" 2>&1 || {
  echo "INPUT GEN FAILED"; cat "$BUILD/gen.log"; exit 5; }

# --- 6. witness ---
say "witness calc"
WASM="$BUILD/solvency_d${DEPTH}_js/solvency_d${DEPTH}.wasm"
T=$(now_ms)
$SNARKJS wtns calculate "$WASM" "$IN/solvency_d${DEPTH}.json" "$BUILD/w.wtns" >"$BUILD/wtns.log" 2>&1 || {
  echo "WITNESS FAILED"; tail -5 "$BUILD/wtns.log"; exit 6; }
WTNS_MS=$(( $(now_ms) - T ))

# --- 7. prove ---
say "groth16 prove"
T=$(now_ms)
$SNARKJS groth16 prove "$KEYS/sol_final.zkey" "$BUILD/w.wtns" \
  "$BUILD/proof.json" "$BUILD/public.json" >"$BUILD/prove.log" 2>&1 || {
  echo "PROVE FAILED"; tail -5 "$BUILD/prove.log"; exit 7; }
PROVE_MS=$(( $(now_ms) - T ))
PROOF_BYTES=$(stat -f%z "$BUILD/proof.json")

# --- 8. verify ---
say "verify"
T=$(now_ms)
if $SNARKJS groth16 verify "$KEYS/vk.json" "$BUILD/public.json" "$BUILD/proof.json" >"$BUILD/verify.log" 2>&1; then
  VERIFY_OK=true
else
  VERIFY_OK=false
fi
VERIFY_MS=$(( $(now_ms) - T ))
say "verify_ms=$VERIFY_MS ok=$VERIFY_OK"

# --- 9. record ---
OUT="$LOGS/bench_d${DEPTH}.json"
cat > "$OUT" <<EOF
{
  "depth": ${DEPTH},
  "accounts": $((1<<DEPTH)),
  "constraints": ${CONSTRAINTS},
  "ptau_power": ${POWER},
  "ptau_mb": $((PTAU_BYTES/1024/1024)),
  "zkey_mb": $((ZKEY_BYTES/1024/1024)),
  "compile_ms": ${COMPILE_MS},
  "setup_ms": ${SETUP_MS},
  "witness_ms": ${WTNS_MS},
  "prove_ms": ${PROVE_MS},
  "verify_ms": ${VERIFY_MS},
  "proof_bytes": ${PROOF_BYTES},
  "verify_ok": ${VERIFY_OK}
}
EOF
echo "----- RESULT d${DEPTH} -----"
cat "$OUT"
[ "$VERIFY_OK" = true ] || exit 8