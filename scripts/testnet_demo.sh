#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# testnet_demo.sh  --  End-to-end Tessera demo against the deployed contract on
# Stellar testnet. Every call is a real transaction / simulation; tx hashes are printed.
#
# Requires: stellar CLI, identities tessera-deployer + tessera-treasury, and
#   contracts/artifacts/signed-onchain-args.json (from gen_signed_fixtures.js).
# ---------------------------------------------------------------------------
set -uo pipefail
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARGS="$ROOT/contracts/artifacts/signed-onchain-args.json"
PY=/usr/bin/python3

CONTRACT="${CONTRACT:?set CONTRACT to the deployed contract id}"
NET=testnet
RES=tessera-treasury       # treasury holder: authorizes submit (proof of CONTROL)
ISS=tessera-deployer       # issuer: registers signed leaves

j() { $PY -c "import json,sys;print(json.load(open('$ARGS'))$1)"; }

hr() { echo "───────────────────────────────────────────────────────────────"; }

echo "CONTRACT=$CONTRACT"
hr; echo "STEP 1  submit HONEST attestation  (treasury holder authorizes => CONTROL proof)"
PROOF=$(j "['honest_solvency']['proof_hex']")
PUB=$(j "['honest_solvency']['public_hex']" )
# public_hex is a python list; render as a JSON array string
PUBJSON=$($PY -c "import json;print(json.dumps(json.load(open('$ARGS'))['honest_solvency']['public_hex']))")
stellar contract invoke --id "$CONTRACT" --source "$RES" --network "$NET" -- \
  submit_attestation --proof "$PROOF" --public_signals "$PUBJSON"

hr; echo "STEP 2  register 4 SIGNED leaves (A,B,C,D) — ed25519 verified ON-CHAIN"
E0=$($PY -c "import json;print(json.dumps(json.load(open('$ARGS'))['epoch0_leaves_cli']))")
stellar contract invoke --id "$CONTRACT" --source "$ISS" --network "$NET" -- \
  register_signed_leaves --leaves "$E0"

hr; echo "STEP 3  user C: is_registered? (expect true)"
CLEAF=$($PY -c "import json;print(json.load(open('$ARGS'))['epoch0_leaves_cli'][2]['leaf_commitment'])")
stellar contract invoke --id "$CONTRACT" --source "$ISS" --network "$NET" -- \
  is_registered --leaf_commitment "$CLEAF"

hr; echo "STEP 4  user C: verify_inclusion against attested honest root (expect true)"
IPROOF=$(j "['user_c_inclusion']['proof_hex']")
IPUB=$($PY -c "import json;print(json.dumps(json.load(open('$ARGS'))['user_c_inclusion']['public_hex']))")
stellar contract invoke --id "$CONTRACT" --source "$ISS" --network "$NET" -- \
  verify_inclusion --proof "$IPROOF" --public_signals "$IPUB"

hr; echo "STEP 5  submit OMITTED attestation (tree WITHOUT user C) => epoch 1"
OPROOF=$(j "['omitted_solvency']['proof_hex']")
OPUB=$($PY -c "import json;print(json.dumps(json.load(open('$ARGS'))['omitted_solvency']['public_hex']))")
stellar contract invoke --id "$CONTRACT" --source "$RES" --network "$NET" -- \
  submit_attestation --proof "$OPROOF" --public_signals "$OPUB"

hr; echo "STEP 6  register epoch-1 leaves WITHOUT C (A,B,D only)"
E1=$($PY -c "import json;print(json.dumps(json.load(open('$ARGS'))['epoch1_leaves_no_c_cli']))")
stellar contract invoke --id "$CONTRACT" --source "$ISS" --network "$NET" -- \
  register_signed_leaves --leaves "$E1"

hr; echo "STEP 7  user C: is_registered now? (expect FALSE — omitted)"
stellar contract invoke --id "$CONTRACT" --source "$ISS" --network "$NET" -- \
  is_registered --leaf_commitment "$CLEAF"

hr; echo "STEP 8  user C: verify_inclusion vs omitted root (expect FALSE)"
stellar contract invoke --id "$CONTRACT" --source "$ISS" --network "$NET" -- \
  verify_inclusion --proof "$IPROOF" --public_signals "$IPUB"

hr; echo "STEP 9  user C: verify_signed_claim(epoch=1) — C's ed25519 claim STILL verifies on-chain (OMISSION proof)"
CCLAIM=$($PY -c "import json;print(json.dumps(json.load(open('$ARGS'))['user_c_epoch1_claim_cli']))")
stellar contract invoke --id "$CONTRACT" --source "$ISS" --network "$NET" -- \
  verify_signed_claim --epoch 1 --leaf "$CCLAIM"

hr; echo "STEP 10  FORGED leaf registration must FAIL (issuer cannot fabricate a member)"
FORGED=$($PY -c "import json;a=json.load(open('$ARGS'));print(json.dumps([a['epoch1_leaves_no_c_cli'][0], a['forged_leaf_cli']]))")
stellar contract invoke --id "$CONTRACT" --source "$ISS" --network "$NET" -- \
  register_signed_leaves --leaves "$FORGED" ; echo "(exit: $? — nonzero == correctly rejected)"

hr; echo "DONE"