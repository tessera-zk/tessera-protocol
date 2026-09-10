#!/usr/bin/env node
// validate_sep.js -- SEP record validator (issue #70, v0.2 policy layer).
// Dependency-free: enforces docs/SEP-ATTESTATION-SCHEMA.json directly
// (required, type, const, pattern, enum, minimum, minLength) so the schema
// file stays the single source of truth, then applies POLICY checks the
// schema cannot express (tier/method consistency, method registry).
//
// Usage:
//   node scripts/validate_sep.js [record.json ...]   # validate record files
//   node scripts/validate_sep.js --doc <examples.md> # validate embedded ```json blocks
//   node scripts/validate_sep.js --strict <files>    # warnings also fail
//
// Exit 0: no schema ERRORS (warnings printed either way).
// Exit 1: schema errors (or warnings with --strict).
// Exit 2: usage / IO error.
//
// Module API (used by scripts/validate_sep.test.js):
//   validateRecord(obj) -> { errors: string[], warnings: string[] }
//   canonicalize(obj) -> string (sorted-keys, compact JSON)
const fs = require("fs");
const path = require("path");

const SCHEMA_PATH = path.join(__dirname, "..", "docs", "SEP-ATTESTATION-SCHEMA.json");
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));

// Method registry (mirrors docs/SEP-METHOD-REGISTRY.md — keep in sync).
// Only the signed method evidences the in-circuit omission tier.
const METHOD_REGISTRY = {
  "groth16-bn254-merkle-sum/1": { tiers: ["none", "vigilance"], desc: "base health proof" },
  "groth16-bn254-signed-merkle-sum/1": { tiers: ["none", "vigilance", "in-circuit"], desc: "health + in-circuit EdDSA + key pin" },
  "groth16-bn254-risk-merkle-sum/1": { tiers: ["none", "vigilance"], desc: "health + per-leaf risk bounds" },
  "self-declared/1": { tiers: ["none"], desc: "no proof (assurance-free)" },
};
const SIGNED_METHOD = "groth16-bn254-signed-merkle-sum/1";

function checkType(v, t) {
  if (t === "string") return typeof v === "string";
  if (t === "integer") return typeof v === "number" && Number.isInteger(v);
  if (t === "boolean") return typeof v === "boolean";
  if (t === "object") return typeof v === "object" && v !== null && !Array.isArray(v);
  return true;
}

// Canonical JSON: sorted keys recursively, compact separators. Two readers
// building the same record MUST produce these identical bytes (checklist box).
function canonicalize(v) {
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  if (v !== null && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) =>
      JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

function validateRecord(rec) {
  const errors = [], warnings = [];
  if (rec === null || typeof rec !== "object" || Array.isArray(rec)) {
    return { errors: ["record must be a JSON object"], warnings };
  }
  for (const f of schema.required || []) {
    if (!(f in rec)) errors.push(`missing field: ${f}`);
  }
  for (const [f, rule] of Object.entries(schema.properties || {})) {
    if (!(f in rec)) continue;
    const v = rec[f];
    if (rule.type && !checkType(v, rule.type)) { errors.push(`${f}: expected ${rule.type}`); continue; }
    if (rule.const !== undefined && v !== rule.const) errors.push(`${f}: must equal ${JSON.stringify(rule.const)}`);
    if (rule.pattern && !(new RegExp(rule.pattern).test(v))) errors.push(`${f}: fails pattern ${rule.pattern}`);
    if (rule.enum && !rule.enum.includes(v)) errors.push(`${f}: not in enum ${rule.enum.join("|")}`);
    if (rule.minimum !== undefined && v < rule.minimum) errors.push(`${f}: below minimum ${rule.minimum}`);
    if (rule.minLength !== undefined && v.length < rule.minLength) errors.push(`${f}: shorter than minLength ${rule.minLength}`);
  }
  // ---- policy layer (schema-valid but assurance-questionable) ----
  if ("method" in rec && "non_omission" in rec) {
    const known = Object.prototype.hasOwnProperty.call(METHOD_REGISTRY, rec.method);
    if (!known) {
      warnings.push(`UNREGISTERED_METHOD: '${rec.method}' not in docs/SEP-METHOD-REGISTRY.md`);
    } else if (!METHOD_REGISTRY[rec.method].tiers.includes(rec.non_omission)) {
      warnings.push(`TIER_METHOD_MISMATCH: tier '${rec.non_omission}' not evidenced by method '${rec.method}'`);
    }
    if (rec.non_omission === "in-circuit" && rec.method !== SIGNED_METHOD) {
      if (known) warnings.push(`TIER_METHOD_MISMATCH: in-circuit tier requires '${SIGNED_METHOD}'`);
      // unknown method + in-circuit already warns UNREGISTERED_METHOD above;
      // the mismatch is implied (an unknown method evidences nothing).
    }
  }
  return { errors, warnings };
}

function extractJsonBlocks(md) {
  const blocks = [];
  const re = /```json\n([\s\S]*?)```/g;
  let m, i = 0;
  while ((m = re.exec(md)) !== null) {
    blocks.push({ index: ++i, text: m[1] });
  }
  return blocks;
}

async function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const rest = args.filter((a) => a !== "--strict");
  let files = [];
  if (rest[0] === "--doc" && rest[1]) {
    const md = fs.readFileSync(rest[1], "utf8");
    const blocks = extractJsonBlocks(md);
    if (blocks.length === 0) { console.error("no ```json blocks found"); process.exit(2); }
    let bad = 0;
    for (const b of blocks) {
      let rec;
      try { rec = JSON.parse(b.text); }
      catch (e) { console.error(`block ${b.index}: INVALID JSON (${e.message})`); bad++; continue; }
      const { errors, warnings } = validateRecord(rec);
      for (const w of warnings) console.log(`block ${b.index}: warning: ${w}`);
      if (errors.length > 0 || (strict && warnings.length > 0)) {
        console.error(`block ${b.index}: FAIL\n  ${errors.concat(strict ? warnings : []).join("\n  ")}`);
        bad++;
      } else {
        console.log(`block ${b.index}: OK${warnings.length ? " (with warnings)" : ""}`);
      }
    }
    console.log(bad === 0 ? "SEP DOC RESULT: all blocks valid" : `SEP DOC RESULT: ${bad} block(s) invalid`);
    process.exit(bad === 0 ? 0 : 1);
  }
  files = rest;
  if (files.length === 0) {
    console.error("usage: validate_sep.js [--strict] [--doc <md> | record.json ...]");
    process.exit(2);
  }
  let bad = 0;
  for (const f of files) {
    let rec;
    try { rec = JSON.parse(fs.readFileSync(f, "utf8")); }
    catch (e) { console.error(`${f}: unreadable (${e.message})`); bad++; continue; }
    const { errors, warnings } = validateRecord(rec);
    for (const w of warnings) console.log(`${f}: warning: ${w}`);
    if (errors.length > 0 || (strict && warnings.length > 0)) {
      console.error(`${f}: FAIL\n  ${errors.concat(strict ? warnings : []).join("\n  ")}`);
      bad++;
    } else {
      console.log(`${f}: OK${warnings.length ? " (with warnings)" : ""}`);
    }
  }
  process.exit(bad === 0 ? 0 : 1);
}

module.exports = { validateRecord, canonicalize, METHOD_REGISTRY, SIGNED_METHOD };
if (require.main === module) main();
