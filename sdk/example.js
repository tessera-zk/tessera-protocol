// example.js — <5-minute integration demo (issue #42). No network: uses a
// stub fetch returning a canned v1 payload, exercising the real code path.
// Usage: node sdk/example.js
import { fetchStatus } from "./src/reads.js";
import { badgeEmbedHtml } from "./src/embed.js";
import { isFullyBacked } from "./src/types.js";

const stubFetch = async (url) => ({
  ok: true,
  json: async () => ({
    ok: true, status: "healthy", contract: "CBTN433J...",
    epoch: 3, totalCommitments: "184140", treasury: "189140",
    boundTreasury: "189140", liveReserveBalance: "189140", ratioPct: 102.72,
    rootHash: "28d91750...", treasuryHolder: "GDYNFRF3...",
    controlProven: true, nonOmissionInCircuit: true,
    boundLedger: 4490585, timestamp: 1788510000, tx: "https://...",
    _fetchedFrom: url,
  }),
});

const status = await fetchStatus("https://issuer.example", stubFetch);
console.log("status:", status.status, "| ratio:", status.ratioPct + "%", "| fully-backed:", isFullyBacked(status));
console.log("embed:", badgeEmbedHtml("https://issuer.example"));
console.log("shape rejects garbage:", await fetchStatus("https://x", async () => ({ ok: true, json: async () => ({}) })).then(() => "NO (bad)", (e) => `YES (${e.message})`));
