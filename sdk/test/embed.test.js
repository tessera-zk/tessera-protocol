// embed.test.js — badge URL/embed helper tests (issue #68).
// Run: node --test sdk/test/embed.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { BADGE_API_VERSION, badgeSvgUrl, badgeEmbedHtml } from "../src/embed.js";

test("badge API version pinned at 1", () => {
  assert.equal(BADGE_API_VERSION, 1);
});

test("svg URL shape + trailing-slash tolerance", () => {
  assert.equal(
    badgeSvgUrl("https://issuer.example/"),
    "https://issuer.example/api/badge/svg?label=Tessera");
  assert.equal(
    badgeSvgUrl("https://issuer.example", "My Fund"),
    "https://issuer.example/api/badge/svg?label=My%20Fund");
});

test("label is URL-encoded (no injection into src)", () => {
  const url = badgeSvgUrl("https://x", '"><script>alert(1)</script>');
  assert.ok(!url.includes("<") && !url.includes(">"), "raw angle brackets must not appear");
  assert.ok(url.includes("%22%3E"), "quotes must be percent-encoded");
});

test("embed HTML links board + embeds svg with fixed dimensions", () => {
  const html = badgeEmbedHtml("https://issuer.example", "T");
  assert.ok(html.includes('href="https://issuer.example/badge"'));
  assert.ok(html.includes('src="https://issuer.example/api/badge/svg?label=T"'));
  assert.ok(html.includes('width="220"') && html.includes('height="28"'));
  assert.ok(html.includes('rel="noreferrer"'));
});
