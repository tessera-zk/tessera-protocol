pragma circom 2.2.3;

// ---------------------------------------------------------------------------
// risk_solvency.circom  --  UPGRADE 3 demo instantiation (depth 4 = 16 accounts,
// 64-bit balances). Proves solvency PLUS a concentration cap and a minimum
// collateralization ratio, all in zero knowledge. See lib/risk_solvency_tpl.circom.
//
// Public signal order (MUST match the Soroban verifier contract):
//   [ rootHash, totalLiabilities, reserves, maxConcBps, minCollBps ]
// ---------------------------------------------------------------------------

include "lib/risk_solvency_tpl.circom";

component main { public [rootHash, totalLiabilities, reserves, maxConcBps, minCollBps] } =
    RiskSolvency(4, 64);
