// package.test.js — export-surface guard (issue #68). Fails if a published
// subpath stops importing or drops an expected member (packaging drift).
// Run: node --test sdk/test/package.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

test("reads subpath exports", async () => {
  const reads = await import("../src/reads.js");
  assert.equal(typeof reads.fetchStatus, "function");
  assert.equal(typeof reads.statusUrl, "function");
});

test("embed subpath exports", async () => {
  const embed = await import("../src/embed.js");
  assert.equal(typeof embed.badgeSvgUrl, "function");
  assert.equal(typeof embed.badgeEmbedHtml, "function");
  assert.equal(embed.BADGE_API_VERSION, 1);
});

test("types subpath exports", async () => {
  const types = await import("../src/types.js");
  assert.equal(typeof types.isFullyBacked, "function");
  assert.equal(typeof types.assertStatusShape, "function");
  assert.ok(Array.isArray(types.STATUS_REQUIRED_FIELDS));
});
