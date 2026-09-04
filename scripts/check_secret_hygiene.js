// check_secret_hygiene.js -- fail if a NEXT_PUBLIC *secret* appears (issue #25).
// Server-side key must be TESSERA_TREASURY_SECRET in frontend/.env.local only.
// Public client config (NEXT_PUBLIC_TESSERA_CONTRACT_ID, NEXT_PUBLIC_*RPC_URL,
// NEXT_PUBLIC_HORIZON_URL, NEXT_PUBLIC_NETWORK) is intentionally browser-safe
// and must NOT trip this gate -- only a SECRET suffix indicates a signing key
// leaked to the browser bundle.
// Usage: node scripts/check_secret_hygiene.js
const { execSync } = require("child_process");
try {
  const out = execSync("grep -rn 'NEXT_PUBLIC_[A-Z0-9_]*SECRET' docs/ README.md frontend/README.md frontend/app frontend/lib frontend/components 2>/dev/null || true", { encoding: "utf8" }).trim();
  // Allowlist: this very script mentions the pattern in its own source; filter self.
  const lines = out.split("\n").filter(Boolean).filter((l) => !l.includes("check_secret_hygiene"));
  if (lines.length) {
    console.error("SECRET HYGIENE FAIL: NEXT_PUBLIC secret pattern found:");
    console.error(lines.join("\n"));
    process.exit(1);
  }
  console.log("secret hygiene OK: no NEXT_PUBLIC secret in docs/app/lib");
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
