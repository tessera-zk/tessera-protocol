#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# prove_signed.sh  --  UPGRADE 1 IN-CIRCUIT EdDSA (FIX 1 model): prove the honest
# signed book VERIFIES, prove the OMISSION book also VERIFIES at the circuit level
# (its enforcement is now ON-CHAIN via the public-key pin, not in-circuit), and
# prove the FORGERY attack is UNPROVABLE (witness calculation aborts on the EdDSA
# equality constraint). Also proves user-C inclusion against the attested root.
#
# FIX 1 note: signer keys are now PUBLIC inputs the Soroban contract pins against
# the member-self-registered key list. So an omitting issuer CAN build a valid
# proof over a substituted key set, but the contract rejects it (RegisteredSetMismatch,
# demonstrated on testnet in scripts/testnet_signed_demo.sh). Only the FORGERY of a
# signature remains cryptographically impossible at the circuit level.
#
# Depends on: scripts/build_signed.sh having produced circuit-keys/signed_solvency_final.zkey
# and build/inputs/signed_*.json.
# ---------------------------------------------------------------------------
set -uo pipefail   # no -e: negative cases are expected to fail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Toolchain - use PATH-resolved binaries for CI portability
NODE=$(which node)
SNARKJS_JS=$(which snarkjs)
SNARKJS="$NODE $SNARKJS_JS"

KEYS="$ROOT/circuit-keys"
IN="$ROOT/build/inputs"
PROOFS="$ROOT/build/proofs"
mkdir -p "$PROOFS"

echo "==> Regenerating in-circuit EdDSA inputs"
$NODE scripts/gen_signed_incircuit.js

pass=0; fail=0

prove_ok () { # <label> <circuit> <zkey> <vk> <input> <proofOut> <pubOut>
  local label="$1" circ="$2" zkey="$3" vk="$4" input="$5" proof="$6" pub="$7"
  echo ""
  echo "=================================================================="
  echo "POSITIVE: $label  -- expect VERIFY"
  echo "=================================================================="
  local wasm="$ROOT/build/${circ}_js/${circ}.wasm"
  local wtns="$PROOFS/${circ}_pos.wtns"
  $SNARKJS wtns calculate "$wasm" "$IN/$input" "$wtns" || { echo "FAIL witness"; fail=$((fail+1)); return; }
  $SNARKJS groth16 prove "$zkey" "$wtns" "$proof" "$pub" || { echo "FAIL prove"; fail=$((fail+1)); return; }
  echo "--- public signals ($pub) ---"; cat "$pub"; echo ""
  if $SNARKJS groth16 verify "$vk" "$pub" "$proof"; then
    echo "RESULT: VERIFIED OK"; pass=$((pass+1))
  else
    echo "RESULT: verification FAILED (unexpected)"; fail=$((fail+1))
  fi
}

prove_reject () { # <label> <circuit> <input> <why>
  local label="$1" circ="$2" input="$3" why="$4"
  echo ""
  echo "=================================================================="
  echo "NEGATIVE: $label  -- expect UNPROVABLE ($why)"
  echo "=================================================================="
  local wasm="$ROOT/build/${circ}_js/${circ}.wasm"
  local wtns="$PROOFS/${circ}_neg.wtns"
  if $SNARKJS wtns calculate "$wasm" "$IN/$input" "$wtns" 2>&1; then
    echo "RESULT: circuit ACCEPTED attack (SECURITY FAILURE)"; fail=$((fail+1))
  else
    echo "RESULT: REJECTED as expected (constraint unsatisfiable -> no proof exists)"; pass=$((pass+1))
  fi
}

# Honest signed book verifies.
prove_ok "honest signed book (4 in-circuit EdDSA sigs, public keys)" signed_solvency \
  "$KEYS/signed_solvency_final.zkey" "$KEYS/vk_signed_solvency.json" \
  signed_solvency.json "$PROOFS/signed_solvency_proof.json" "$PROOFS/signed_solvency_public.json"

# OMISSION book ALSO verifies at circuit level (issuer signs its own filler); the
# public signer key at slot C differs from the registered key, so it is REJECTED
# ON-CHAIN by the contract key pin (see scripts/testnet_signed_demo.sh).
prove_ok "omission book (filler key at slot C) — valid proof, REJECTED on-chain" signed_solvency \
  "$KEYS/signed_solvency_final.zkey" "$KEYS/vk_signed_solvency.json" \
  signed_solvency_omitted.json "$PROOFS/signed_solvency_omitted_proof.json" "$PROOFS/signed_solvency_omitted_public.json"

# User C inclusion against the in-circuit-attested root (depth-2 instance).
prove_ok "user C inclusion vs signed root" signed_inclusion \
  "$KEYS/signed_inclusion_final.zkey" "$KEYS/vk_signed_inclusion.json" \
  signed_inclusion.json "$PROOFS/signed_inclusion_proof.json" "$PROOFS/signed_inclusion_public.json"

# The FORGERY attack is cryptographically impossible at the circuit level.
prove_reject "FORGERY: flip a bit of user C's signature" \
  signed_solvency signed_solvency_forged.json "EdDSAPoseidonVerifier equality fails"

echo ""
echo "=================================================================="
echo "SIGNED SUMMARY: pass=$pass fail=$fail"
echo "  (non-omission is enforced ON-CHAIN by the public-key pin; the omission"
echo "   proof above verifies here but is rejected by submit_signed_attestation.)"
echo "=================================================================="
[ "$fail" -eq 0 ] || exit 1