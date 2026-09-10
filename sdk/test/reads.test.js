// reads.test.js — fetchStatus contract tests (issue #68). No network:
// every case injects a stub fetch. Run: node --test sdk/test/reads.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchStatus, statusUrl } from "../src/reads.js";

const GOOD = {
  ok: true, status: "healthy", contract: "CDSAQVJCHBDQ6SGXYHXBIAWPN4BM4BAR6FE3HMBFO6WOTKBGQ7B2MJWZ",
  epoch: 0, totalCommitments: "184140", treasury: "189140",
  boundTreasury: "189140", liveReserveBalance: "189140", ratioPct: 102.72,
  rootHash: "28d91750661fb24465616eb4ef70f381c7863cd970d17f4da840d102264eeff7",
  treasuryHolder: "GDYNFRF3FHYBX42UHYCWGFJ2MFXHZJIXBLII7TQU5YOM6ICTKZPOMKCP",
  controlProven: true, nonOmissionInCircuit: false,
  boundLedger: 4490585, timestamp: 1788510000,
};

const stub = (payload, ok = true, status = 200) => async () => ({
  ok, status, json: async () => structuredClone(payload),
});

test("statusUrl strips trailing slash, appends path", () => {
  assert.equal(statusUrl("https://issuer.example/"), "https://issuer.example/api/solvency");
  assert.equal(statusUrl("https://issuer.example"), "https://issuer.example/api/solvency");
});

test("healthy payload passes through with identity", async () => {
  const s = await fetchStatus("https://issuer.example", stub(GOOD));
  assert.equal(s.status, "healthy");
  assert.equal(s.rootHash, GOOD.rootHash);
});

test("garbage payload throws BAD_STATUS (missing field named)", async () => {
  await assert.rejects(
    fetchStatus("https://x", stub({ ok: true })),
    /BAD_STATUS: missing field status/);
});

test("null/empty payload throws BAD_STATUS", async () => {
  await assert.rejects(fetchStatus("https://x", stub(null)), /BAD_STATUS/);
  await assert.rejects(fetchStatus("https://x", stub({})), /BAD_STATUS/);
});

test("HTTP error surfaces as STATUS_HTTP_n (no silent fallback)", async () => {
  await assert.rejects(fetchStatus("https://x", stub({}, false, 503)), /STATUS_HTTP_503/);
  await assert.rejects(fetchStatus("https://x", stub({}, false, 404)), /STATUS_HTTP_404/);
});

test("underfunded status passes shape (semantics left to caller)", async () => {
  const s = await fetchStatus("https://x", stub({ ...GOOD, status: "underfunded" }));
  assert.equal(s.status, "underfunded");
});
