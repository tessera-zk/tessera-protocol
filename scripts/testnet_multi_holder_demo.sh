#!/usr/bin/env bash
# testnet_multi_holder_demo.sh -- 2-holder same-unit aggregate demo (issue #7).
# Read-only until the final submits; requires stellar CLI + funded testnet keys.
# Same-unit only (FIX 2): both legs must be the same unit (e.g. two USDC accounts).
set -euo pipefail
: "${CONTRACT:?set CONTRACT to the deployed Tessera contract id}"
: "${HOLDER_A:?set HOLDER_A (first reserve holder G...)}"
: "${HOLDER_B:?set HOLDER_B (second reserve holder G...)}"
: "${TOKEN_A:?set TOKEN_A (first SAC C...)}"
: "${TOKEN_B:?set TOKEN_B (second same-unit SAC C...)}"
NETWORK="${NETWORK:-testnet}"

echo "[multi-holder] contract: $CONTRACT"
echo "[multi-holder] leg A: holder=$HOLDER_A token=$TOKEN_A (1:1)"
echo "[multi-holder] leg B: holder=$HOLDER_B token=$TOKEN_B (1:1)"
echo "[multi-holder] 1) set_reserve_legs (two 1:1 legs)..."
echo "  stellar contract invoke --id $CONTRACT --network $NETWORK --source <admin> -- set_reserve_legs --legs '[{\"holder\":\"$HOLDER_A\",\"token\":\"$TOKEN_A\",\"scale_num\":1,\"scale_den\":1},{\"holder\":\"$HOLDER_B\",\"token\":\"$TOKEN_B\",\"scale_num\":1,\"scale_den\":1}]'"
echo "[multi-holder] 2) aggregate_reserves..."
echo "  stellar contract invoke --id $CONTRACT --network $NETWORK -- aggregate_reserves"
echo "[multi-holder] 3) submit_multi_attestation (BOTH holders authorize)..."
echo "  stellar contract invoke --id $CONTRACT --network $NETWORK --source <issuer> -- submit_multi_attestation --proof <hex> --public-signals <hex>"
echo "  NOTE: each leg holder must provide an auth entry (two signatures). With one"
echo "  signer across both legs the tx still succeeds but proves less (see RUNBOOK)."
echo "[multi-holder] 4) verify: get_attestation + event attest/multi leg_count 2."
echo "[multi-holder] done (dry-run; uncomment stellar calls to execute)."
