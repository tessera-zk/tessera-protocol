// validate_sep.test.js — adversarial SEP corpus (issue #70).
// Every case pins a validator behavior: schema errors fail LOUD with the
// field named; policy smells warn WITHOUT failing (shape vs assurance split).
// Run: node --test scripts/validate_sep.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateRecord, canonicalize } = require("./validate_sep.js");

const GOOD = {
  sep: "tessera-attestation/0.1",
  contract: "CDSAQVJCHBDQ6SGXYHXBIAWPN4BM4BAR6FE3HMBFO6WOTKBGQ7B2MJWZ",
  epoch: 2,
  root_hash: "08ac11ac6db6f93236032d8800642f213fd53f0849d5624de16f6b73531f1012",
  total_commitments: "28000",
  treasury: "30000",
  treasury_holder: "GDYNFRF3FHYBX42UHYCWGFJ2MFXHZJIXBLII7TQU5YOM6ICTKZPOMKCP",
  reserve_token: "CDVAJVBYDHXI535W3ZA43XN7L2IL3XK2C5WQYCDJHDHUTW4NTGZVC2VS",
  bound_ledger: 4603225,
  control_proven: true,
  non_omission: "in-circuit",
  method: "groth16-bn254-signed-merkle-sum/1",
  tx: "66cbf46f69efed8e484856fbe73b9c6092a567d23a3728b9c4cb7a17a39cdcbe",
};

const clean = () => validateRecord(structuredClone(GOOD));

test("honest signed record: zero errors, zero warnings", () => {
  const { errors, warnings } = clean();
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("missing field fails LOUD with the field named", () => {
  const r = structuredClone(GOOD);
  delete r.root_hash;
  const { errors } = validateRecord(r);
  assert.ok(errors.some((e) => e.includes("root_hash")), errors.join(";"));
});

test("malformed contract (lowercase, short) fails pattern", () => {
  for (const bad of ["cdsaqvjchbdq6sgxyhxb...", "C", "CDSA", "G" + "A".repeat(55)]) {
    const r = structuredClone(GOOD);
    r.contract = bad;
    assert.ok(validateRecord(r).errors.some((e) => e.startsWith("contract:")), bad);
  }
});

test("muxed M-address holder rejected (intentional v0.2 scope — see checklist)", () => {
  const r = structuredClone(GOOD);
  r.treasury_holder = "M" + "A".repeat(68);
  const { errors } = validateRecord(r);
  assert.ok(errors.some((e) => e.startsWith("treasury_holder:")), errors.join(";"));
});

test("uppercase root hex rejected (lowercase-canonical only)", () => {
  const r = structuredClone(GOOD);
  r.root_hash = GOOD.root_hash.toUpperCase();
  assert.ok(validateRecord(r).errors.some((e) => e.startsWith("root_hash:")));
});

test("short tx hash rejected", () => {
  const r = structuredClone(GOOD);
  r.tx = "66cbf46f";
  assert.ok(validateRecord(r).errors.some((e) => e.startsWith("tx:")));
});

test("negative / fractional epoch rejected", () => {
  for (const epoch of [-1, 1.5]) {
    const r = structuredClone(GOOD);
    r.epoch = epoch;
    assert.ok(validateRecord(r).errors.length > 0, `epoch=${epoch}`);
  }
});

test("unknown tier rejected by enum", () => {
  const r = structuredClone(GOOD);
  r.non_omission = "audited";
  assert.ok(validateRecord(r).errors.some((e) => e.includes("enum")));
});

test("tier-conflation: in-circuit claim on a self-declared method WARNS (shape still valid)", () => {
  const r = structuredClone(GOOD);
  r.method = "self-declared/1";
  const { errors, warnings } = validateRecord(r);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes("TIER_METHOD_MISMATCH")), warnings.join(";"));
});

test("unregistered method + none tier: warning only, record shape-valid", () => {
  const r = structuredClone(GOOD);
  r.method = "my-prover/9";
  r.non_omission = "none";
  const { errors, warnings } = validateRecord(r);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes("UNREGISTERED_METHOD")), warnings.join(";"));
});

test("unregistered method + in-circuit tier: unregistered warning (evidences nothing)", () => {
  const r = structuredClone(GOOD);
  r.method = "my-prover/9";
  const { errors, warnings } = validateRecord(r);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes("UNREGISTERED_METHOD")), warnings.join(";"));
});

test("base method cannot carry in-circuit tier", () => {
  const r = structuredClone(GOOD);
  r.method = "groth16-bn254-merkle-sum/1";
  const { errors, warnings } = validateRecord(r);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes("TIER_METHOD_MISMATCH")), warnings.join(";"));
});

test("extra fields allowed (forward-compatible)", () => {
  const r = { ...structuredClone(GOOD), aggregate_reserves: "200000", leg_count: 2 };
  const { errors } = validateRecord(r);
  assert.deepEqual(errors, []);
});

test("non-boolean control_proven rejected", () => {
  const r = structuredClone(GOOD);
  r.control_proven = "yes";
  assert.ok(validateRecord(r).errors.some((e) => e.startsWith("control_proven:")));
});

test("numeric totals rejected (uint-as-string domain)", () => {
  const r = structuredClone(GOOD);
  r.total_commitments = 28000;
  assert.ok(validateRecord(r).errors.some((e) => e.startsWith("total_commitments:")));
});

test("canonicalization: literal vs parsed-reserialized agree byte-for-byte", () => {
  const a = canonicalize(GOOD);
  const b = canonicalize(JSON.parse(JSON.stringify(GOOD)));
  assert.equal(a, b);
  // key order in source is irrelevant to canonical bytes
  const shuffled = {};
  for (const k of Object.keys(GOOD).reverse()) shuffled[k] = GOOD[k];
  assert.equal(canonicalize(shuffled), a);
  assert.ok(!a.includes(" ") && !a.includes("\n"), "compact form");
});
