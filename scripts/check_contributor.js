// check_contributor.js — PR hygiene gate for contributors (closes #128).
// Enforces CONTRIBUTING.md + PR template rules in CI and locally.
//
// Checks:
//   1. PR body links an issue: `Closes #<n>` (required; no issue, no merge)
//   2. Branch name: feat|fix|chore|docs|test/<slug>-<issue-number>
//   3. Commit prefixes: feat|fix|chore|docs|test|ci[(scope)]: ... (merge commits exempt)
//   4. DCO sign-off: every non-merge commit has `Signed-off-by:` trailer
//   5. Forbidden paths never in the diff (secrets/build artifacts/keys)
//   6. Evidence: >=1 evidence box ticked; Honesty: all 5 boxes ticked
//   7. Secret hygiene: no NEXT_PUBLIC_*SECRET in changed docs/app files
//
// Usage (CI): node scripts/check_contributor.js   (reads GITHUB_* env + `gh pr view`)
// Usage (local):
//   node scripts/check_contributor.js --pr 123
//   node scripts/check_contributor.js --pr-body-file /tmp/body.md --branch feat/foo-128 --commits-file /tmp/commits.txt --files-file /tmp/files.txt
//   node scripts/check_contributor.js --help
//
// Pure validators are exported for node:test coverage (see check_contributor.test.js).

const { execSync } = require("child_process");
const fs = require("fs");

const BRANCH_RE = /^(feat|fix|chore|docs|test)\/[a-z0-9][a-z0-9-]*-\d+$/;
const COMMIT_RE = /^(feat|fix|chore|docs|test|ci)(\([a-z0-9_-]+\))?: .+/;
const CLOSES_RE = /closes\s+#\d+/i;
const FORBIDDEN_RES = [
  /(^|\/)\.env\.local($|\/)/,
  /(^|\/)build\/.*/,
  /(^|\/)ptau\/.*/,
  /(^|\/)target\/.*/,
  /(^|\/)\.next\/.*/,
  /\.zkey$/,
  /\.ptau$/,
  /(^|\/)circuit-keys\/.*\.zkey$/,
];
const EVIDENCE_LABELS = ["Passing tests", "Testnet tx hash", "Tagged NOT-YET"];
const HONESTY_LABELS = [
  "No relaxed Error #13",
  "No per-member concentration claim",
  "Single-contributor setup caveat",
  "Docs updated for every source-of-truth change",
  "No secrets in client-side code or docs",
];

function hasClosesRef(body) {
  return CLOSES_RE.test(body || "");
}

function checkBranch(branch) {
  if (!branch) return { ok: false, detail: "empty branch name" };
  if (branch === "main" || branch === "master")
    return { ok: true, detail: "push to default branch (PR checks skipped for branch name)" };
  return BRANCH_RE.test(branch)
    ? { ok: true }
    : { ok: false, detail: `must match ${BRANCH_RE} (e.g. feat/contributor-checks-128)` };
}

function checkCommitLine(line) {
  const subject = line.trim();
  if (!subject) return { ok: true, skipped: true };
  if (/^merge\b/i.test(subject)) return { ok: true, skipped: true, merge: true };
  return COMMIT_RE.test(subject)
    ? { ok: true }
    : { ok: false, detail: `must match <type>[(scope)]: subject — got: ${subject.slice(0, 80)}` };
}

function checkDco(body) {
  return /^signed-off-by:\s*.+<.+@.+>/im.test(body || "");
}

function forbiddenPathHits(files) {
  return (files || []).filter((f) => FORBIDDEN_RES.some((re) => re.test(f)));
}

function ticked(body, labelFragment) {
  // Matches `- [x] ...labelFragment...` case-insensitively.
  const re = new RegExp(`-\\s*\\[x\\][^\\n]*${escapeRegExp(labelFragment)}`, "i");
  return re.test(body || "");
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkEvidence(body) {
  const hit = EVIDENCE_LABELS.filter((l) => ticked(body, l));
  return hit.length >= 1
    ? { ok: true, hit }
    : { ok: false, detail: "tick >=1 evidence box (tests / tx hash / NOT-YET)" };
}

function checkHonesty(body) {
  const missing = HONESTY_LABELS.filter((l) => !ticked(body, l));
  return missing.length === 0
    ? { ok: true }
    : { ok: false, detail: `unticked honesty items: ${missing.join("; ")}` };
}

function secretHitsInFiles(files, execFn) {
  // Only scan changed docs/app surfaces (same scope as check_secret_hygiene.js).
  const scannable = (files || []).filter((f) =>
    /^(docs\/|README\.md|PRD\.md|ARCHITECTURE\.md|ADVANCED-STATUS\.md|BENCHMARKS\.md|frontend\/(app|lib|components|README\.md))/i.test(f),
  );
  if (scannable.length === 0) return [];
  const run = execFn || ((cmd) => execSync(cmd, { encoding: "utf8" }));
  const hits = [];
  for (const f of scannable) {
    try {
      const content = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        if (/NEXT_PUBLIC_[A-Z0-9_]*SECRET/.test(line) && !line.includes("check_secret_hygiene")) {
          hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
        }
      });
    } catch {
      // Fall back to grep for deleted/renamed paths.
      try {
        const out = run(`grep -n 'NEXT_PUBLIC_[A-Z0-9_]*SECRET' "${f}" 2>/dev/null || true`);
        if (out.trim()) hits.push(`${f}: ${out.trim().slice(0, 200)}`);
      } catch { /* ignore */ }
    }
  }
  return hits;
}

// ---- IO helpers (impure; kept thin so validators stay unit-testable) ----

function parseArgs(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--pr") o.pr = argv[++i];
    else if (a === "--pr-body-file") o.prBodyFile = argv[++i];
    else if (a === "--branch") o.branch = argv[++i];
    else if (a === "--commits-file") o.commitsFile = argv[++i];
    else if (a === "--files-file") o.filesFile = argv[++i];
    else if (a === "--base") o.base = argv[++i];
  }
  return o;
}

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function parseCommitsFile(path) {
  // Groups raw lines into commits: a line matching a commit subject (or Merge)
  // starts a new record; following non-subject lines (e.g. Signed-off-by)
  // append to that commit's body. Supports %x1e record separators too.
  const raw = fs.readFileSync(path, "utf8").replace(/\x1e/g, "\n");
  const lines = raw.split("\n");
  const commits = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (COMMIT_RE.test(line.trim()) || /^merge\b/i.test(line.trim())) {
      commits.push({ subject: line.trim(), body: "" });
    } else if (commits.length === 0) {
      commits.push({ subject: line.trim(), body: line });
    } else {
      commits[commits.length - 1].body += (commits[commits.length - 1].body ? "\n" : "") + line;
    }
  }
  return commits.map((c) => ({ subject: c.subject, body: `${c.subject}\n${c.body}` }));
}

function getPrContext(opts) {
  // Explicit files win (local/test path).
  if (opts.prBodyFile || opts.branch || opts.commitsFile || opts.filesFile) {
    return {
      body: opts.prBodyFile ? fs.readFileSync(opts.prBodyFile, "utf8") : "",
      branch: opts.branch || "",
      commits: opts.commitsFile ? parseCommitsFile(opts.commitsFile) : [],
      files: opts.filesFile ? fs.readFileSync(opts.filesFile, "utf8").split("\n").filter(Boolean) : [],
      source: "flags",
    };
  }
  const event = process.env.GITHUB_EVENT_NAME || "";
  const prNumber = opts.pr || process.env.PR_NUMBER || guessPrNumber();
  if (event === "pull_request" || prNumber) {
    try {
      const n = String(prNumber).replace("#", "");
      const body = sh(`gh pr view ${n} --json body --jq .body`);
      const head = sh(`gh pr view ${n} --json headRefName --jq .headRefName`);
      const commitsJson = sh(`gh pr view ${n} --json commits --jq '[.commits[] | {subject: .messageHeadline, body: .messageBody}]'`);
      const filesJson = sh(`gh pr view ${n} --json files --jq '[.files[].path]'`);
      return {
        body,
        branch: head,
        commits: JSON.parse(commitsJson || "[]"),
        files: JSON.parse(filesJson || "[]"),
        source: `gh pr ${n}`,
      };
    } catch (e) {
      throw new Error(`cannot fetch PR via gh (${e.message}); pass --pr-body-file/--branch/--commits-file/--files-file`);
    }
  }
  // Push / local fallback: derive from git.
  const branch = sh(`git rev-parse --abbrev-ref HEAD || true`);
  const base = opts.base || process.env.GITHUB_BASE_REF || "origin/main";
  let subjects = [];
  let files = [];
  try {
    subjects = sh(`git log --format=%s ${base}..HEAD 2>/dev/null || git log -5 --format=%s`).split("\n").filter(Boolean);
  } catch { subjects = []; }
  try {
    files = sh(`git diff --name-only ${base}...HEAD 2>/dev/null || git diff --name-only HEAD~3..HEAD`).split("\n").filter(Boolean);
  } catch { files = []; }
  let bodies = [];
  try {
    bodies = sh(`git log --format=%B%x1e ${base}..HEAD 2>/dev/null || git log -5 --format=%B%x1e`).split("\x1e");
  } catch { bodies = subjects; }
  return {
    body: "",
    branch,
    commits: subjects.map((s, i) => ({ subject: s, body: bodies[i] || s })),
    files,
    source: "git",
    pushMode: event === "push",
  };
}

function guessPrNumber() {
  const ref = process.env.GITHUB_REF || "";
  const m = ref.match(/refs\/pull\/(\d+)\/merge/);
  return m ? m[1] : "";
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(fs.readFileSync(__filename, "utf8").match(/\/\/ check_contributor[\s\S]*?(?=\n\nconst)/)[0]);
    process.exit(0);
  }
  let ctx;
  try {
    ctx = getPrContext(opts);
  } catch (e) {
    console.error(`CONTRIBUTOR GATE FAIL: ${e.message}`);
    process.exit(1);
  }
  const failures = [];
  const isPush = !!ctx.pushMode;

  // 1. Closes ref (PR only).
  if (!isPush) {
    if (hasClosesRef(ctx.body)) console.log("ok 1 - PR body links an issue (Closes #n)");
    else failures.push("1 - PR body must contain `Closes #<n>` (no issue, no merge per CONTRIBUTING.md)");
  }

  // 2. Branch.
  const b = checkBranch(ctx.branch || process.env.GITHUB_HEAD_REF || "");
  if (b.ok) console.log(`ok 2 - branch '${ctx.branch}' naming OK`);
  else failures.push(`2 - branch '${ctx.branch}': ${b.detail}`);

  // 3+4. Commits.
  if (ctx.commits.length === 0) {
    failures.push("3 - no commits found to lint (fetch-depth must be 0 in CI)");
  } else {
    let badPrefix = 0, badDco = 0;
    for (const c of ctx.commits) {
      const r = checkCommitLine(c.subject || "");
      if (!(r.ok || r.skipped)) { badPrefix++; failures.push(`3 - commit prefix: ${(c.subject || "").slice(0, 100)}`); break; }
      const full = `${c.subject || ""}\n${c.body || ""}`;
      if (!r.merge && !checkDco(full)) { badDco++; failures.push(`4 - DCO sign-off missing in: ${(c.subject || "").slice(0, 100)} (add \`git commit -s\`)`); break; }
    }
    if (badPrefix === 0) console.log(`ok 3 - ${ctx.commits.length} commit prefix(es) OK`);
    if (badDco === 0) console.log(`ok 4 - DCO sign-off OK (${ctx.commits.length} commit(s))`);
  }

  // 5. Forbidden paths.
  const bad = forbiddenPathHits(ctx.files);
  if (bad.length === 0) console.log(`ok 5 - no forbidden paths in ${ctx.files.length} file(s)`);
  else failures.push(`5 - forbidden paths: ${bad.join(", ")} (see CONTRIBUTING.md §Workflow.4)`);

  // 6. Evidence + honesty (PR only).
  if (!isPush) {
    const ev = checkEvidence(ctx.body);
    if (ev.ok) console.log("ok 6a - evidence box ticked");
    else failures.push(`6a - ${ev.detail}`);
    const ho = checkHonesty(ctx.body);
    if (ho.ok) console.log("ok 6b - honesty checklist complete");
    else failures.push(`6b - ${ho.detail}`);
  }

  // 7. Secret hygiene on changed files.
  const sh = secretHitsInFiles(ctx.files);
  if (sh.length === 0) console.log("ok 7 - secret hygiene OK (no NEXT_PUBLIC secret in changed docs/app)");
  else failures.push(`7 - NEXT_PUBLIC secret pattern in changed files:\n  ${sh.join("\n  ")}`);

  if (failures.length) {
    console.error(`\nCONTRIBUTOR GATE FAIL (${failures.length}):\n- ${failures.join("\n- ")}\n(source: ${ctx.source})`);
    process.exit(1);
  }
  console.log(`\ncontributor gate PASS (source: ${ctx.source})`);
}

if (require.main === module) main();

module.exports = {
  BRANCH_RE, COMMIT_RE, CLOSES_RE, FORBIDDEN_RES,
  hasClosesRef, checkBranch, checkCommitLine, checkDco,
  forbiddenPathHits, checkEvidence, checkHonesty, secretHitsInFiles, ticked,
};
