// check_contributor.test.js — unit tests for the contributor gate (issue #128).
// Run: node --test scripts/check_contributor.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("./check_contributor");

test("Closes ref detection", () => {
  assert.equal(c.hasClosesRef("Closes #128"), true);
  assert.equal(c.hasClosesRef("closes #62 fix"), true);
  assert.equal(c.hasClosesRef("No link here"), false);
});

test("branch naming", () => {
  assert.equal(c.checkBranch("feat/contributor-checks-128").ok, true);
  assert.equal(c.checkBranch("fix/risk-latest-62").ok, true);
  assert.equal(c.checkBranch("docs/anchor-guide-116").ok, true);
  assert.equal(c.checkBranch("chore/ptau-mirror-127").ok, true);
  assert.equal(c.checkBranch("test/fuzz-124").ok, true);
  assert.equal(c.checkBranch("random/thing").ok, false);
  assert.equal(c.checkBranch("feat/no-number").ok, false);
  assert.equal(c.checkBranch("").ok, false);
});

test("commit prefixes (merge exempt)", () => {
  assert.equal(c.checkCommitLine("feat(contracts): add keyed entrypoint").ok, true);
  assert.equal(c.checkCommitLine("docs: update runbook").ok, true);
  assert.equal(c.checkCommitLine("ci(contributor): add hygiene gate").ok, true);
  assert.equal(c.checkCommitLine("Merge pull request #78").ok, true);
  assert.equal(c.checkCommitLine("Merge branch 'x'").ok, true);
  assert.equal(c.checkCommitLine("random stuff").ok, false);
  assert.equal(c.checkCommitLine("Feat: caps").ok, false);
});

test("DCO sign-off", () => {
  assert.equal(c.checkDco("feat: x\n\nSigned-off-by: A <a@b.c>"), true);
  assert.equal(c.checkDco("feat: x\nno trailer"), false);
});

test("forbidden paths", () => {
  assert.deepEqual(c.forbiddenPathHits(["contracts/a.rs", "docs/X.md"]), []);
  assert.equal(c.forbiddenPathHits(["frontend/.env.local"]).length, 1);
  assert.equal(c.forbiddenPathHits(["build/inputs/x.json"]).length, 1);
  assert.equal(c.forbiddenPathHits(["target/wasm/x.wasm"]).length, 1);
  assert.equal(c.forbiddenPathHits(["a.zkey"]).length, 1);
  assert.equal(c.forbiddenPathHits(["ptau/pot15.ptau"]).length, 1);
  assert.equal(c.forbiddenPathHits([".next/static/x.js"]).length, 1);
});

test("evidence needs >=1 tick", () => {
  const good = "- [x] Passing tests (`cargo test`)";
  const bad = "- [ ] Passing tests\n- [ ] Testnet tx hash\n- [ ] Tagged NOT-YET";
  assert.equal(c.checkEvidence(good).ok, true);
  assert.equal(c.checkEvidence(bad).ok, false);
});

test("honesty needs all 5 ticked", () => {
  const good = [
    "- [x] No relaxed Error #13",
    "- [x] No per-member concentration claim",
    "- [x] Single-contributor setup caveat",
    "- [x] Docs updated for every source-of-truth change",
    "- [x] No secrets in client-side code or docs",
  ].join("\n");
  const bad = good.replace("[x] No secrets", "[ ] No secrets");
  assert.equal(c.checkEvidence("- [x] Testnet tx hash (abc)").ok, true);
  assert.equal(c.checkHonesty(good).ok, true);
  assert.equal(c.checkHonesty(bad).ok, false);
});

test("secret scan ignores self-mention, catches leak", () => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "contrib-"));
  const leak = path.join(dir, "LEAK.md");
  // outside scanned prefixes on purpose — call with explicit prefix override below
  fs.writeFileSync(leak, "key=NEXT_PUBLIC_FOO_SECRET\n");
  // secretHitsInFiles only scans known prefixes; docs/ prefix triggers scan:
  const docsLeak = "docs/_contrib_test_leak.md";
  fs.writeFileSync(docsLeak, "key=NEXT_PUBLIC_FOO_SECRET\n");
  try {
    const hits = c.secretHitsInFiles([docsLeak]);
    assert.equal(hits.length, 1);
    const clean = c.secretHitsInFiles(["docs/CI-RUNBOOK.md"]);
    assert.equal(clean.length, 0);
  } finally {
    fs.rmSync(leak, { force: true });
    fs.rmSync(docsLeak, { force: true });
    fs.rmdirSync(dir, { recursive: true });
  }
});
