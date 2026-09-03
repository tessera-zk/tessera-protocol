// ---------------------------------------------------------------------------
// gen_risk_input.js  --  UPGRADE 3 witness inputs for risk_solvency.circom.
//
// Emits:
//   build/inputs/risk_solvency.json          healthy book (passes both limits)
//   build/inputs/risk_solvency_concentrated.json  one whale > cap -> unprovable
//   build/inputs/risk_solvency_undercoll.json      reserves < min ratio -> unprovable
//
// Merkle-sum tree per lib/merkle_sum.circom: acctCommit=Poseidon(a,b);
// leaf=Poseidon(acctCommit,balance); parent=Poseidon(Lh,Ls,Rh,Rs).
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { buildPoseidon } = require("circomlibjs");

const DEPTH = 4;
const N = 1 << DEPTH; // 16

const MAX_CONC_BPS = 4000n;   // no single account may exceed 40% of the book
const MIN_COLL_BPS = 10500n;  // reserves must be >= 105% of liabilities

(async () => {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const H = (arr) => F.toObject(poseidon(arr));

  function buildRoot(balances, accts) {
    let ch = balances.map((b, i) => H([accts[i], b]));
    let cs = balances.slice();
    while (ch.length > 1) {
      const nh = [], ns = [];
      for (let i = 0; i < ch.length; i += 2) {
        nh.push(H([ch[i], cs[i], ch[i + 1], cs[i + 1]]));
        ns.push(cs[i] + cs[i + 1]);
      }
      ch = nh; cs = ns;
    }
    return { rootHash: ch[0], rootSum: cs[0] };
  }

  const acct = (i) => H([BigInt(0xa11c0000 + i), BigInt(0x5a170000 + i)]);
  const accts = Array.from({ length: N }, (_, i) => acct(i));

  const outDir = path.join(__dirname, "..", "build", "inputs");
  fs.mkdirSync(outDir, { recursive: true });
  const write = (name, obj) =>
    fs.writeFileSync(path.join(outDir, name),
      JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));

  function mk(balances, reserves) {
    const { rootHash, rootSum } = buildRoot(balances, accts);
    return {
      rootHash, totalLiabilities: rootSum, reserves,
      maxConcBps: MAX_CONC_BPS, minCollBps: MIN_COLL_BPS,
      balances, acctCommit: accts,
    };
  }

  // ---- HEALTHY: well-diversified, over-collateralized ----
  // 8 real accounts, each 10000..17000; total 108000; max 17000 = 15.7% < 40%.
  const healthy = Array.from({ length: N }, (_, i) => (i < 8 ? 10000n + BigInt(i) * 1000n : 0n));
  const healthyTotal = healthy.reduce((a, b) => a + b, 0n);
  const healthyReserves = (healthyTotal * 110n) / 100n; // 110% >= 105% min
  write("risk_solvency.json", mk(healthy, healthyReserves));

  // ---- CONCENTRATED: one whale is 60% of the book (> 40% cap) -> unprovable ----
  const conc = new Array(N).fill(0n);
  conc[0] = 60000n; // whale
  conc[1] = 20000n;
  conc[2] = 20000n; // total 100000; whale = 60% > 40%
  const concReserves = (100000n * 110n) / 100n;
  write("risk_solvency_concentrated.json", mk(conc, concReserves));

  // ---- UNDER-COLLATERALIZED: solvent (R>=L) but reserves < 105% min ratio ----
  const uc = healthy.slice();
  const ucTotal = uc.reduce((a, b) => a + b, 0n);
  const ucReserves = (ucTotal * 102n) / 100n; // 102% : R>=L holds, but < 105% min
  write("risk_solvency_undercoll.json", mk(uc, ucReserves));

  console.log("UPGRADE 3 risk inputs built.");
  console.log("  healthy: total=", healthyTotal.toString(), "reserves=", healthyReserves.toString(),
    "maxSingle%=", (Number(17000n * 10000n / healthyTotal) / 100).toFixed(2));
  console.log("  concentrated: whale 60% > 40% cap -> must be unprovable");
  console.log("  undercoll: 102% reserves < 105% min ratio -> must be unprovable");
})().catch((e) => { console.error(e); process.exit(1); });
