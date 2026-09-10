// example.js — <5-minute integration demo (issue #42). No network: uses a
// stub fetch returning a canned v1 payload, exercising the real code path.
// Usage: node sdk/example.js
import { fetchStatus } from "./src/reads.js";
import { badgeEmbedHtml } from "./src/embed.js";
import { isFullyBacked } from "./src/types.js";

const stubFetch = async (url) => ({
  ok: true,
  json: async () => ({
    // Canned v1 payload mirroring the REAL canonical epoch-0 attestation
    // (docs/SEP-ATTESTATION-EXAMPLES.md Ex.1) so the demo prints true values.
    ok: true, status: "healthy",
    contract: "CDSAQVJCHBDQ6SGXYHXBIAWPN4BM4BAR6FE3HMBFO6WOTKBGQ7B2MJWZ",
    epoch: 0, totalCommitments: "184140", treasury: "189140",
    boundTreasury: "189140", liveReserveBalance: "189140", ratioPct: 102.72,
    rootHash: "28d91750661fb24465616eb4ef70f381c7863cd970d17f4da840d102264eeff7",
    treasuryHolder: "GDYNFRF3FHYBX42UHYCWGFJ2MFXHZJIXBLII7TQU5YOM6ICTKZPOMKCP",
    controlProven: true, nonOmissionInCircuit: false,
    boundLedger: 4490585, timestamp: 1788510000, tx: "https://...",
    _fetchedFrom: url,
  }),
});

const status = await fetchStatus("https://issuer.example", stubFetch);
console.log("status:", status.status, "| ratio:", status.ratioPct + "%", "| fully-backed:", isFullyBacked(status));
console.log("embed:", badgeEmbedHtml("https://issuer.example"));
console.log("shape rejects garbage:", await fetchStatus("https://x", async () => ({ ok: true, json: async () => ({}) })).then(() => "NO (bad)", (e) => `YES (${e.message})`));
