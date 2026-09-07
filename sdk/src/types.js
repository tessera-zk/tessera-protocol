// types.js — shared shapes (issue #42). Plain JSDoc-typed JS, no build step.
// Mirrors /api/solvency v1 and the contract Attestation struct. Read-only.

/**
 * @typedef {"healthy"|"underfunded"|"no-attestation"} BadgeStatus
 * @typedef {Object} TreasuryStatus
 * @property {boolean} ok
 * @property {BadgeStatus} status
 * @property {string} contract
 * @property {number} epoch
 * @property {string} totalCommitments
 * @property {string} treasury
 * @property {string} boundTreasury
 * @property {string|null} liveReserveBalance
 * @property {number|null} ratioPct
 * @property {string} rootHash
 * @property {boolean} controlProven
 * @property {boolean} nonOmissionInCircuit
 */

/** Required fields a status payload must carry (v1). */
export const STATUS_REQUIRED_FIELDS = [
  "ok", "status", "contract", "epoch", "totalCommitments", "treasury",
  "boundTreasury", "rootHash", "controlProven", "nonOmissionInCircuit",
];

/** True iff the payload is healthy AND control-proven (full trust bar). */
export function isFullyBacked(s) {
  return s?.status === "healthy" && s?.controlProven === true;
}

/** Throw on a malformed v1 payload (fail fast at the integration boundary). */
export function assertStatusShape(s) {
  for (const f of STATUS_REQUIRED_FIELDS) {
    if (!(f in Object(s))) throw new Error(`BAD_STATUS: missing field ${f}`);
  }
  return s;
}
