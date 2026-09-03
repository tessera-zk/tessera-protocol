export const AUTHORITATIVE_CONTRACT = "REPLACE_AFTER_DEPLOY";

export const TREASURY_HOLDER = "REPLACE_AFTER_DEPLOY";

export const TREASURY_TOKEN = "REPLACE_AFTER_DEPLOY";

export const ADVANCED_TXS = {
  deploy: "REPLACE_AFTER_DEPLOY",
  registerA: "REPLACE_AFTER_DEPLOY",
  registerB: "REPLACE_AFTER_DEPLOY",
  registerC: "REPLACE_AFTER_DEPLOY",
  registerD: "REPLACE_AFTER_DEPLOY",
  signedHonest: "REPLACE_AFTER_DEPLOY",
  setReserveLegs: "REPLACE_AFTER_DEPLOY",
  multiHonest: "REPLACE_AFTER_DEPLOY",
} as const;

export const RISK_EVIDENCE = {
  maxConcBps: 4000,
  minCollBps: 10500,
  scope: "Per-leaf concentration cap. Per-member aggregation is not yet wired.",
  script: "scripts/testnet_risk_demo.sh",
};

export const REJECTIONS = {
  omission: {
    code: "Error #10",
    label: "RegisteredSetMismatch",
    reason:
      "A valid proof built with a filler key at member C's slot fails the on-chain registered-key pin.",
  },
  replay: {
    code: "Error #14",
    label: "StaleEpoch",
    reason: "Reusing the same signed epoch is rejected before storage.",
  },
  badScale: {
    code: "Error #13",
    label: "BadReserveLeg",
    reason: "Non-1:1 reserve scales are rejected. The fixed contract supports same-unit aggregation only.",
  },
  riskWhale: {
    code: "No witness",
    label: "Concentration violation",
    reason:
      "A set with any leaf above the public concentration cap cannot satisfy risk_solvency constraints.",
  },
  undercollateralized: {
    code: "No witness",
    label: "Collateral floor violation",
    reason:
      "A set below the 105% collateralization public input cannot satisfy risk_solvency constraints.",
  },
} as const;