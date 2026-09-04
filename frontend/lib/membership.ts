// membership.ts — registry vs proof-set reconciliation helper (issue #12).
// Read-only; surfaces the exact mismatch the contract would reject (#10).

export type KeyPair = { ax: string; ay: string };

export function findRegistryGaps(
  registered: KeyPair[],
  proofKeys: KeyPair[],
): { missing: KeyPair[]; extra: KeyPair[]; aligned: boolean } {
  const norm = (k: KeyPair) => `${k.ax.toLowerCase()}:${k.ay.toLowerCase()}`;
  const regSet = new Set(registered.map(norm));
  const proofSet = new Set(proofKeys.map(norm));
  const missing = registered.filter((k) => !proofSet.has(norm(k)));
  const extra = proofKeys.filter((k) => !regSet.has(norm(k)));
  const aligned =
    missing.length === 0 &&
    extra.length === 0 &&
    registered.length === proofKeys.length &&
    registered.every((k, i) => norm(k) === norm(proofKeys[i]));
  return { missing, extra, aligned };
}

export function membershipChecklist(registeredCount: number, proofCount: number): string[] {
  const out: string[] = [];
  out.push(`registered_key_count() = ${registeredCount}`);
  out.push(`proof public keys = ${proofCount}`);
  out.push(registeredCount === proofCount ? "counts match" : "COUNT MISMATCH: submit would fail Error #10");
  out.push("epoch must exceed signed_epoch() (else Error #14)");
  return out;
}
