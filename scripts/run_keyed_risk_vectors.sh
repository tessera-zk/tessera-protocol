#!/usr/bin/env bash
# run_keyed_risk_vectors.sh -- execute KR-1..KR-4 through check_keyed_risk.js.
# Vectors are generated at runtime (node one-liners, no fixtures committed).
# Expected: KR-1 PASS, KR-2 PASS (Sybil caveat, documented), KR-3 FAIL, KR-4 FAIL.
# Exit 0 iff all four behave as expected (fails are asserted via exit code 2).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mk() { node -e "console.log(JSON.stringify($1))" > "$2"; }
mk '{rootHash:"0",totalLiabilities:"16000",reserves:"16800",Ax:["0","0","0","0"],Ay:["0","0","0","0"],maxConcBps:"4000",minCollBps:"10500",balances:["4000","4000","4000","4000"],nonces:["1","2","3","4"]}' "$TMP/kr1.json"
mk '{rootHash:"0",totalLiabilities:"16000",reserves:"16800",Ax:["0","0","0","0"],Ay:["0","0","0","0"],maxConcBps:"4000",minCollBps:"10500",balances:["4000","4000","4000","4000"],nonces:["1","2","3","4"]}' "$TMP/kr2.json"
mk '{rootHash:"0",totalLiabilities:"16000",reserves:"16800",Ax:["0","0","0","0"],Ay:["0","0","0","0"],maxConcBps:"4000",minCollBps:"10500",balances:["12000","2000","1000","1000"],nonces:["1","2","3","4"]}' "$TMP/kr3.json"
mk '{rootHash:"0",totalLiabilities:"16000",reserves:"16000",Ax:["0","0","0","0"],Ay:["0","0","0","0"],maxConcBps:"4000",minCollBps:"10500",balances:["4000","4000","4000","4000"],nonces:["1","2","3","4"]}' "$TMP/kr4.json"
pass=0; fail=0
expect() { # $1=name $2=file $3=want(exit code)
  if node scripts/check_keyed_risk.js "$2" >/dev/null 2>&1; then got=0; else got=$?; fi
  if [ "$got" = "$3" ]; then echo "KR $1: as expected (exit $got)"; pass=$((pass+1)); else echo "KR $1: UNEXPECTED (want $3, got $got)"; fail=$((fail+1)); fi
}
expect "1 even-book"      "$TMP/kr1.json" 0
expect "2 split-holder"   "$TMP/kr2.json" 0
expect "3 whale-position" "$TMP/kr3.json" 2
expect "4 thin-reserves"  "$TMP/kr4.json" 2
echo "vectors: $pass as-expected, $fail unexpected"
[ "$fail" = 0 ]
