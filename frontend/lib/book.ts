// Loading + persistence of the commitment set and its attested tree.

import type { Account } from "./merkle";

export type RawAccount = {
  index: number;
  label: string;
  acctId: number | string;
  salt: number | string;
  balance: number | string;
};

export type SampleBook = {
  note: string;
  depth: number;
  reserves: number;
  accounts: RawAccount[];
};

export function toAccounts(raw: RawAccount[]): Account[] {
  return raw.map((a, i) => ({
    index: i,
    label: a.label,
    acctId: BigInt(a.acctId),
    salt: BigInt(a.salt),
    balance: BigInt(a.balance),
  }));
}

export async function loadSampleBook(): Promise<{ accounts: Account[]; reserves: bigint }> {
  const res = await fetch("/sample-book.json");
  if (!res.ok) throw new Error(`Failed to load sample book: ${res.status}`);
  const book: SampleBook = await res.json();
  return { accounts: toAccounts(book.accounts), reserves: BigInt(book.reserves) };
}

// The set last attested from this browser, persisted so the membership view can
// reconstruct the exact tree the contract now stores.
const KEY = "tessera.ledger.book.v1";

export type PersistedBook = {
  accounts: {
    index: number;
    label: string;
    acctId: string;
    salt: string;
    balance: string;
  }[];
  reserves: string;
  rootHashHex: string;
  txHash?: string;
  epoch?: number;
  at: number;
};

export function persistAttestedBook(book: PersistedBook): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(book));
}

export function loadAttestedBook(): PersistedBook | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedBook;
  } catch (err) {
    console.error("[book] failed to parse persisted book", err);
    return null;
  }
}

export function persistedToAccounts(b: PersistedBook): Account[] {
  return b.accounts.map((a) => ({
    index: a.index,
    label: a.label,
    acctId: BigInt(a.acctId),
    salt: BigInt(a.salt),
    balance: BigInt(a.balance),
  }));
}

/** Parse a CSV with columns: label,acctId,balance (salt auto-derived, header optional). */
export function parseCsv(text: string): Account[] {
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  const out: Account[] = [];
  let idx = 0;
  for (const row of rows) {
    const cols = row.split(",").map((c) => c.trim());
    // skip header
    if (idx === 0 && /[a-df-zA-DF-Z]/.test(cols[cols.length - 1]) && isNaN(Number(cols[cols.length - 1]))) {
      continue;
    }
    if (cols.length < 2) continue;
    let label: string, acctId: bigint, balance: bigint;
    if (cols.length >= 3) {
      label = cols[0] || `Member ${idx}`;
      acctId = BigInt(cols[1] || 100000 + idx);
      balance = BigInt(cols[2]);
    } else {
      label = `Member ${idx}`;
      acctId = BigInt(cols[0] || 100000 + idx);
      balance = BigInt(cols[1]);
    }
    out.push({
      index: idx,
      label,
      acctId,
      salt: BigInt(0xbeef0000 + idx * 11),
      balance,
    });
    idx++;
  }
  return out;
}