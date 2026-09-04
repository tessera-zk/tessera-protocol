// gen_keyed_risk_input.js -- demo input for the keyed-risk prototype (issue #11).
// Mirrors risk demo book (8 accounts shape at depth 2 = 4 leaves here).
// Keys are structural placeholders (zeros) until real Baby-JubJub keys land.
// Usage: node scripts/gen_keyed_risk_input.js
const balances = [4000, 4000, 4000, 4000]; // even book, 0% whale
const nonces = [1, 2, 3, 4];
console.log(JSON.stringify({
  rootHash: "0",
  totalLiabilities: "16000",
  reserves: "16800", // 105%
  Ax: ["0", "0", "0", "0"],
  Ay: ["0", "0", "0", "0"],
  maxConcBps: "4000",
  minCollBps: "10500",
  balances: balances.map(String),
  nonces: nonces.map(String),
}, null, 2));
