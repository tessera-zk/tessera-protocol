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
echo "  NOTE (#59): vec-of-struct args MUST go via --legs-file-path with i128"
echo "  values as JSON STRINGS (\"scale_num\":\"1\"); bare numbers are rejected."
echo "  node scripts/gen_multi_holder_args.js > /tmp/legs.json  # then stringify scales"
echo "  stellar contract invoke --id $CONTRACT --network $NETWORK --source <admin> --send=yes -- set_reserve_legs --legs-file-path /tmp/legs.json"
echo "[multi-holder] 2) aggregate_reserves..."
echo "  stellar contract invoke --id $CONTRACT --network $NETWORK -- aggregate_reserves"
echo "[multi-holder] 3) submit_multi_attestation (BOTH holders authorize)..."
echo "  stellar contract invoke --id $CONTRACT --network $NETWORK --source <holderA-identity> --build-only -- submit_multi_attestation --proof <hex> --public_signals-file-path /tmp/multi_pub.json > /tmp/multi_unsigned.xdr"
echo "  UNSIGNED_XDR=/tmp/multi_unsigned.xdr SIGNERS=<holderA-identity>,<holderB-identity> node scripts/two_signer_submit.js"
echo "  NOTE (#59): --sign-with-key is single-use and 'tx sign' chaining adds"
echo "  ENVELOPE sigs only (TxBadAuthExtra/TxBadAuth). Entry-level auth via the"
echo "  script above. LIVE precedent: tx 168785eb… (ledger 4603136)."
echo "[multi-holder] 4) verify: get_attestation + event attest/multi leg_count 2."
echo "[multi-holder] done (dry-run; uncomment stellar calls to execute)."
