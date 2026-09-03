#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# testnet_risk_demo.sh  --  UPGRADE 3 (concentration + min-collateralization)
# demo against the deployed contract on Stellar testnet. Real tx.
#
# Submits a risk_solvency proof that certifies, in zero knowledge, that the book
# is healthy AND diversified (no leaf > 40%) AND over-collateralized (>=105%).
# A concentrated or thinly-collateralized book is UNPROVABLE (scripts/prove_risk.sh),
# so no such proof could be submitted here.
#
# Requires: stellar CLI, identity tessera-treasury, contracts/artifacts/risk-args.json.
# ---------------------------------------------------------------------------
set -uo pipefail
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARGS="$ROOT/contracts/artifacts/risk-args.json"
PY=/usr/bin/python3

CONTRACT="${CONTRACT:?set CONTRACT to the deployed contract id}"
NET=testnet
RES=tessera-treasury

j() { $PY -c "import json;print(json.load(open('$ARGS'))$1)"; }
hr() { echo "───────────────────────────────────────────────────────────────"; }

echo "CONTRACT=$CONTRACT"
hr; echo "STEP 1  submit SAFETY-LIMIT proof (healthy + <40% concentration + >=105% collateral)"
PROOF=$(j "['risk_solvency']['proof_hex']")
PUBJSON=$($PY -c "import json;print(json.dumps(json.load(open('$ARGS'))['risk_solvency']['public_hex']))")
stellar contract invoke --id "$CONTRACT" --source "$RES" --network "$NET" -- \
  submit_risk_attestation --proof "$PROOF" --public_signals "$PUBJSON"

hr; echo "STEP 2  get_risk_attestation (expect max_conc_bps=4000, min_coll_bps=10500)"
stellar contract invoke --id "$CONTRACT" --source "$RES" --network "$NET" -- \
  get_risk_attestation

hr; echo "DONE"