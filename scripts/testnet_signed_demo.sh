#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# testnet_signed_demo.sh  --  FIX 1 (member-verifiable, issuer-uncontrollable
# non-omission) + FIX 4 (freshness) demo against a deployed contract on Stellar
# testnet. Every positive call is a real tx; the negatives trap in simulation.
#
# Flow:
#   1. Four members SELF-REGISTER their Baby-JubJub keys (member.require_auth).
#   2. HONEST submit_signed_attestation verifies on-chain and stores (non-omission).
#   3. OMISSION proof (filler key at slot C) is REJECTED on-chain (Error #10).
#   4. REPLAY of the honest proof (same epoch) is REJECTED on-chain (Error #14).
#
# Requires: stellar CLI, identity tessera-treasury (treasury holder), four member
# identities tessera-member-a..d (generate+fund with `stellar keys generate <id>
# --network testnet --fund`), and contracts/artifacts/signed-incircuit-args.json
# (from contracts/scripts/convert_signed.js). BytesN args are hex WITHOUT 0x.
# ---------------------------------------------------------------------------
set -uo pipefail
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARGS="$ROOT/contracts/artifacts/signed-incircuit-args.json"
PY=/usr/bin/python3

CONTRACT="${CONTRACT:?set CONTRACT to the deployed contract id}"
NET=testnet
RES=tessera-treasury       # treasury holder: authorizes submit (proof of CONTROL)

j()  { $PY -c "import json;print(json.load(open('$ARGS'))$1)"; }
jj() { $PY -c "import json;print(json.dumps(json.load(open('$ARGS'))$1))"; }
hr() { echo "───────────────────────────────────────────────────────────────"; }

echo "CONTRACT=$CONTRACT"

hr; echo "STEP 1  four members SELF-REGISTER their keys (member.require_auth)"
for pair in 0:a 1:b 2:c 3:d; do
  i=${pair%%:*}; n=${pair##*:}
  AX=$(j "['registered_keys'][$i]['ax_hex']")
  AY=$(j "['registered_keys'][$i]['ay_hex']")
  CUST=$(stellar keys address tessera-member-$n)
  echo "  member $n ($CUST) registers key[$i]"
  stellar contract invoke --id "$CONTRACT" --source tessera-member-$n --network "$NET" -- \
    register_customer_key --customer "$CUST" --ax "$AX" --ay "$AY"
done
echo "  registered_key_count (expect 4):"
stellar contract invoke --id "$CONTRACT" --source "$RES" --network "$NET" -- registered_key_count

hr; echo "STEP 2  submit HONEST in-circuit signed_solvency proof (expect stored, epoch 0)"
PROOF=$(j "['signed_solvency']['proof_hex']")
PUB=$(jj "['signed_solvency']['public_hex']")
stellar contract invoke --id "$CONTRACT" --source "$RES" --network "$NET" -- \
  submit_signed_attestation --proof "$PROOF" --public_signals "$PUB"

hr; echo "STEP 3  get_attestation (expect non_omission_in_circuit=true, control_proven=true)"
stellar contract invoke --id "$CONTRACT" --source "$RES" --network "$NET" -- get_attestation

hr; echo "STEP 4  OMISSION proof (valid proof, filler key at slot C) — expect REJECT #10"
OPROOF=$(j "['omission']['proof_hex']")
OPUB=$(jj "['omission']['public_hex']")
stellar contract invoke --id "$CONTRACT" --source "$RES" --network "$NET" -- \
  submit_signed_attestation --proof "$OPROOF" --public_signals "$OPUB" \
  ; echo "(exit $? — nonzero == correctly rejected on-chain by the key pin)"

hr; echo "STEP 5  REPLAY the honest proof (same epoch 0) — expect REJECT #14 (StaleEpoch)"
stellar contract invoke --id "$CONTRACT" --source "$RES" --network "$NET" -- \
  submit_signed_attestation --proof "$PROOF" --public_signals "$PUB" \
  ; echo "(exit $? — nonzero == correctly rejected, stale epoch)"

hr; echo "DONE"