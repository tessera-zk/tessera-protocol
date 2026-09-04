// reflector_prices.js -- stub fetcher for Reflector quotes (issue #10).
// Prints the shape a real integration must return; exits non-zero until wired.
// Usage: node scripts/reflector_prices.js USDC
const asset = process.argv[2] || "USDC";
console.log(JSON.stringify({
  note: "STUB: wire to Reflector contract read; do not use issuer-supplied prices",
  asset,
  quote: null,
  required: ["priceNum (7dp fixed)", "priceLedger", "staleness check <= 100 ledgers"],
}, null, 2));
process.exitCode = 2;
