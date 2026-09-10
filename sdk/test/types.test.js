// types.test.js — trust-bar + shape-guard tests (issue #68).
// Run: node --test sdk/test/types.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isFullyBacked, assertStatusShape, STATUS_REQUIRED_FIELDS } from "../src/types.js";

test("fully-backed needs healthy AND control-proven", () => {
  assert.equal(isFullyBacked({ status: "healthy", controlProven: true }), true);
  assert.equal(isFullyBacked({ status: "healthy", controlProven: false }), false);
  assert.equal(isFullyBacked({ status: "underfunded", controlProven: true }), false);
  assert.equal(isFullyBacked(null), false);
  assert.equal(isFullyBacked(undefined), false);
  assert.equal(isFullyBacked({}), false);
});

test("required-field list covers the trust bar", () => {
  for (const f of ["ok", "status", "contract", "rootHash", "controlProven", "nonOmissionInCircuit"]) {
    assert.ok(STATUS_REQUIRED_FIELDS.includes(f), `missing ${f}`);
  }
});

test("assertStatusShape returns the payload on success", () => {
  const s = Object.fromEntries(STATUS_REQUIRED_FIELDS.map((f) => [f, 1]));
  assert.equal(assertStatusShape(s), s);
});

test("assertStatusShape names the first missing field", () => {
  assert.throws(() => assertStatusShape({ ok: true }), /BAD_STATUS: missing field status/);
});

test("assertStatusShape rejects non-objects", () => {
  assert.throws(() => assertStatusShape(null), /BAD_STATUS/);
  assert.throws(() => assertStatusShape("healthy"), /BAD_STATUS/);
});
