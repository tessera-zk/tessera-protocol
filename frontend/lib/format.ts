// Small formatting helpers. Token amounts are integer units (single-asset demo).

export function fmtUnits(v: bigint | number): string {
  const n = typeof v === "bigint" ? v : BigInt(Math.round(v));
  return n.toLocaleString("en-US");
}

export function fmtRatio(reserves: bigint, liabilities: bigint): string {
  if (liabilities === 0n) return "∞";
  // two decimals, computed in fixed point
  const scaled = (reserves * 10000n) / liabilities;
  const whole = scaled / 100n;
  const frac = (scaled % 100n).toString().padStart(2, "0");
  return `${whole}.${frac}%`;
}

export function shortHex(hex: string, head = 8, tail = 6): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length <= head + tail) return clean;
  return `${clean.slice(0, head)}…${clean.slice(-tail)}`;
}

export function fmtTimestamp(unixSeconds: number): string {
  if (!unixSeconds) return "n/a";
  const d = new Date(unixSeconds * 1000);
  return d.toUTCString().replace("GMT", "UTC");
}

export function bigIntToBeHex32(v: bigint): string {
  let hex = v.toString(16);
  if (hex.length > 64) throw new Error("value exceeds 32 bytes");
  return hex.padStart(64, "0");
}
