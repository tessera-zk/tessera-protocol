// reads.js — read-only status client (issue #42). No secrets, no signing.
// Takes any fetch implementation so Node 18+, browsers, and tests all work.
import { assertStatusShape } from "./types.js";

export function statusUrl(origin) {
  return `${origin.replace(/\/$/, "")}/api/solvency`;
}

/** Fetch + shape-check the treasury status (throws BAD_STATUS on mismatch). */
export async function fetchStatus(origin, fetchImpl = fetch) {
  const res = await fetchImpl(statusUrl(origin));
  if (!res.ok) throw new Error(`STATUS_HTTP_${res.status}`);
  return assertStatusShape(await res.json());
}
