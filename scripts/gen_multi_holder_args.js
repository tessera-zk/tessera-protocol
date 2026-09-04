// gen_multi_holder_args.js -- build set_reserve_legs args for N same-unit holders.
// Enforces FIX 2: every leg must be 1:1 (scale_num == scale_den == 1).
// Usage: HOLDER_A=... TOKEN_A=... HOLDER_B=... TOKEN_B=... node scripts/gen_multi_holder_args.js

function leg(holder, token) {
  if (!holder || !token) throw new Error("holder and token required per leg");
  return { holder, token, scale_num: 1, scale_den: 1 };
}

function main() {
  const legs = [];
  if (process.env.HOLDER_A && process.env.TOKEN_A) legs.push(leg(process.env.HOLDER_A, process.env.TOKEN_A));
  if (process.env.HOLDER_B && process.env.TOKEN_B) legs.push(leg(process.env.HOLDER_B, process.env.TOKEN_B));
  if (process.env.HOLDER_C && process.env.TOKEN_C) legs.push(leg(process.env.HOLDER_C, process.env.TOKEN_C));
  if (legs.length < 2) throw new Error("need at least HOLDER_A/TOKEN_A + HOLDER_B/TOKEN_B for a multi-holder demo");
  // FIX 2 guard: reject any non-1:1 scale before it reaches the contract.
  for (const l of legs) {
    if (l.scale_num !== 1 || l.scale_den !== 1) throw new Error("non-1:1 leg rejected (Error #13)");
  }
  console.log(JSON.stringify({ legs }, null, 2));
}

main();
