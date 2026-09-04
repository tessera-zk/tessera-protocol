// gen_unified_input.js -- deterministic demo input for the unified skeleton.
// Mirrors gen_signed_demo.js shape + risk bounds. Does NOT prove anything;
// output is a witness-input JSON for `circom --wasm` smoke runs only.
//
// Usage: node scripts/gen_unified_input.js > /tmp/unified_input.json

const balances = [8000, 7000, 6000, 7000]; // total 28000, mirrors signed demo
const nonces = [11, 22, 33, 44];
const epoch = 0;
const reserves = 30000;
const maxConcBps = 4000; // 40% per-leaf cap
const minCollBps = 10500; // 105% floor

// Placeholder keys: MUST be replaced with real Baby-JubJub keys + signatures
// from gen_signed_demo.js before any real witness generation. Zeros here keep
// the file honest: this input is structurally complete but cryptographically empty.
const Ax = ["0", "0", "0", "0"];
const Ay = ["0", "0", "0", "0"];
const S = ["0", "0", "0", "0"];
const R8x = ["0", "0", "0", "0"];
const R8y = ["0", "0", "0", "0"];

const out = {
  rootHash: "0", // fill after Merkle-sum recompute
  totalLiabilities: balances.reduce((a, b) => a + b, 0).toString(),
  reserves: reserves.toString(),
  epoch: epoch.toString(),
  Ax, Ay,
  maxConcBps: maxConcBps.toString(),
  minCollBps: minCollBps.toString(),
  balances: balances.map(String),
  nonces: nonces.map(String),
  S, R8x, R8y,
  acctCommitUnused: ["0", "0", "0", "0"],
};

console.log(JSON.stringify(out, null, 2));
