// check_badge_freshness.test.js — SLA verdict unit tests (issue #74).
// Canned v1 payloads only; no network, no clock dependence (explicit nowMs).
// Run: node --test scripts/check_badge_freshness.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { verdict } = require("./check_badge_freshness.js");

const NOW = Date.parse("2026-09-10T12:00:00Z");
const OPTS = { nowMs: NOW, maxAgeSec: 86400, currentLedger: 4604000, maxAgeLedgers: 17280 };
const FRESH_TS = Math.floor(NOW / 1000) - 3600; // 1 h ago

test("fresh wall-clock passes (headline ignored)", () => {
  const v = verdict({ status: "healthy", timestamp: FRESH_TS, boundLedger: 4603900 }, OPTS);
  assert.equal(v.state, "FRESH");
});

test("stale wall-clock fails even when headline says healthy", () => {
  const v = verdict(
    { status: "healthy", timestamp: Math.floor(NOW / 1000) - 90000, boundLedger: 4603900 }, OPTS);
  assert.equal(v.state, "STALE");
  assert.match(v.reason, /wall age/);
});

test("ledger lag beyond SLA fails", () => {
  const v = verdict({ status: "healthy", timestamp: FRESH_TS, boundLedger: 4604000 - 17281 }, OPTS);
  assert.equal(v.state, "STALE");
  assert.match(v.reason, /ledger lag/);
});

test("ledger-only mode works (no timestamp)", () => {
  const v = verdict({ status: "healthy", boundLedger: 4603990 }, OPTS);
  assert.equal(v.state, "FRESH");
});

test("no clock at all is an error, not fresh", () => {
  const v = verdict({ status: "healthy" }, OPTS);
  assert.equal(v.state, "ERROR");
});

test("future timestamp is an error", () => {
  const v = verdict({ status: "healthy", timestamp: Math.floor(NOW / 1000) + 3600 }, OPTS);
  assert.equal(v.state, "ERROR");
});

test("non-object payload is an error", () => {
  assert.equal(verdict(null, OPTS).state, "ERROR");
  assert.equal(verdict([], OPTS).state, "ERROR");
});

test("boundary: age exactly at SLA passes", () => {
  const v = verdict(
    { status: "healthy", timestamp: Math.floor(NOW / 1000) - 86400, boundLedger: 4604000 - 17280 }, OPTS);
  assert.equal(v.state, "FRESH");
});
