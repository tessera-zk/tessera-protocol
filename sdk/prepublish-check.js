// prepublish-check.js — honest publish gate (issue #68).
// `npm publish` runs this via `prepublishOnly`. It MUST fail until the
// audit + versioning-policy conditions are met, so the package cannot be
// published accidentally while still a private scaffold.
// Flip the AUDIT_CLEARED flag only with a recorded audit + version bump.
const AUDIT_CLEARED = false;

if (!AUDIT_CLEARED) {
  console.error(
    "REFUSING TO PUBLISH: @tessera-zk/sdk is a pre-audit scaffold.\n" +
    "See sdk/README.md 'Publish readiness' — audit, changelog, and browser\n" +
    "bundle test must land first. This failure is the gate working."
  );
  process.exit(1);
}
console.log("publish gate: audit cleared, proceeding.");
