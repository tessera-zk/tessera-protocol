#!/usr/bin/env node
// check_badge_freshness.js — badge freshness verdict (issue #74).
// Computes FRESH/STALE from a /api/solvency v1 payload WITHOUT trusting the
// headline `status`: a stale `healthy` badge must never read as current.
// Offline-capable: --status accepts a JSON file (CI mode) or an https URL.
//
// Usage: node scripts/check_badge_freshness.js --status <file|url>
//        [--max-age-sec 86400] [--now <ISO>] [--current-ledger N]
//        [--max-age-ledgers 17280]
// Exit 0 FRESH | 2 STALE:<reason> | 1 ERROR:<reason>
const fs = require("fs");

const DEFAULT_MAX_AGE_SEC = 86400; // 24 h
const DEFAULT_MAX_AGE_LEDGERS = 17280; // ~24 h at 5 s/ledger

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}

// Pure verdict core (unit-tested, no IO).
function verdict(status, opts) {
  const { nowMs, maxAgeSec, currentLedger, maxAgeLedgers } = opts;
  if (status === null || typeof status !== "object" || Array.isArray(status)) {
    return { state: "ERROR", reason: "status payload is not an object" };
  }
  const reasons = [];
  let haveClock = false;
  if (status.timestamp !== undefined && status.timestamp !== null) {
    haveClock = true;
    const ts = Number(status.timestamp) * (String(status.timestamp).length <= 10 ? 1000 : 1);
    if (!Number.isFinite(ts)) return { state: "ERROR", reason: "timestamp not numeric" };
    if (ts > nowMs + 300000) return { state: "ERROR", reason: "timestamp is in the future (clock skew or forgery)" };
    const ageSec = (nowMs - ts) / 1000;
    if (ageSec > maxAgeSec) reasons.push(`wall age ${Math.floor(ageSec)}s > SLA ${maxAgeSec}s`);
  }
  if (currentLedger !== null && status.boundLedger !== undefined && status.boundLedger !== null) {
    haveClock = true;
    const lag = currentLedger - Number(status.boundLedger);
    if (!Number.isFinite(lag)) return { state: "ERROR", reason: "boundLedger not numeric" };
    if (lag < 0) return { state: "ERROR", reason: "boundLedger ahead of current ledger" };
    if (lag > maxAgeLedgers) reasons.push(`ledger lag ${lag} > SLA ${maxAgeLedgers}`);
  }
  if (!haveClock) return { state: "ERROR", reason: "no timestamp and no boundLedger/current-ledger pair" };
  if (reasons.length > 0) return { state: "STALE", reason: reasons.join("; ") };
  return { state: "FRESH", reason: "within SLA on all available clocks" };
}

async function loadStatus(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching status`);
    return res.json();
  }
  return JSON.parse(fs.readFileSync(src, "utf8"));
}

async function main() {
  const src = arg("--status");
  if (!src) { console.error("ERROR: --status <file|url> required"); process.exit(1); }
  const maxAgeSec = Number(arg("--max-age-sec", String(DEFAULT_MAX_AGE_SEC)));
  const maxAgeLedgers = Number(arg("--max-age-ledgers", String(DEFAULT_MAX_AGE_LEDGERS)));
  const nowMs = arg("--now") ? Date.parse(arg("--now")) : Date.now();
  const currentLedger = arg("--current-ledger") !== null ? Number(arg("--current-ledger")) : null;
  if (!Number.isFinite(nowMs)) { console.error("ERROR: unparseable --now"); process.exit(1); }
  let status;
  try {
    status = await loadStatus(src);
  } catch (e) { console.error(`ERROR: ${e.message}`); process.exit(1); }
  const v = verdict(status, { nowMs, maxAgeSec, currentLedger, maxAgeLedgers });
  console.log(`${v.state}:${v.reason}`);
  process.exit(v.state === "FRESH" ? 0 : v.state === "STALE" ? 2 : 1);
}

module.exports = { verdict, DEFAULT_MAX_AGE_SEC, DEFAULT_MAX_AGE_LEDGERS };
if (require.main === module) main();
