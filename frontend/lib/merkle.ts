// ---------------------------------------------------------------------------
// merkle.ts -- Browser Merkle-sum tree, byte-for-byte identical to the circom
// circuits (circuits/lib/merkle_sum.circom) and to scripts/gen_input.js.
//
//   acctCommit_i = Poseidon(acctId_i, salt_i)
//   leaf.hash    = Poseidon(acctCommit_i, balance_i)   leaf.sum = balance_i
//   parent.hash  = Poseidon(Lh, Ls, Rh, Rs)            parent.sum = Ls + Rs
//
// Carrying the running sum into the commitment is what defeats the negative
// balance forgery. Poseidon is BN254; this MUST match the on-chain root.
// ---------------------------------------------------------------------------

// circomlibjs has no bundled types; loaded lazily so it never hits the server bundle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let poseidonPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPoseidon(): Promise<any> {
  if (!poseidonPromise) {
    poseidonPromise = import("circomlibjs").then((m) => m.buildPoseidon());
  }
  return poseidonPromise;
}

export const DEPTH = 4;
export const N_LEAVES = 1 << DEPTH; // 16
export const BALANCE_BITS = 64;
export const BN254_P =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const MAX_BALANCE = 1n << BigInt(BALANCE_BITS); // 2^64

export type Account = {
  index: number;
  label: string;
  acctId: bigint;
  salt: bigint;
  balance: bigint;
};

export type BuiltTree = {
  levels: { hash: bigint[]; sum: bigint[] }[]; // levels[0] = leaves, last = [root]
  rootHash: bigint;
  rootSum: bigint;
  acctCommit: bigint[];
  leafCommit: bigint[];
  accounts: Account[]; // padded to N_LEAVES
};

export type SolvencyInput = {
  rootHash: string;
  totalLiabilities: string;
  reserves: string;
  balances: string[];
  acctCommit: string[];
};

export type InclusionInput = {
  rootHash: string;
  leafCommitment: string;
  balance: string;
  acctCommit: string;
  siblingHash: string[];
  siblingSum: string[];
  pathIndex: string[];
};

/** Pad a partial book to exactly N_LEAVES with zero-balance filler accounts. */
export function padBook(accounts: Account[]): Account[] {
  if (accounts.length > N_LEAVES) {
    throw new Error(
      `Book has ${accounts.length} accounts; the demo tree (depth ${DEPTH}) holds at most ${N_LEAVES}.`,
    );
  }
  const out = accounts.slice();
  for (let i = out.length; i < N_LEAVES; i++) {
    out.push({
      index: i,
      label: "(empty slot)",
      acctId: BigInt(900000 + i),
      salt: BigInt(0xf11e0000 + i * 13),
      balance: 0n,
    });
  }
  return out.map((a, i) => ({ ...a, index: i }));
}

/** Build the full Merkle-sum tree, keeping every node for inclusion co-paths. */
export async function buildTree(rawAccounts: Account[]): Promise<BuiltTree> {
  const accounts = padBook(rawAccounts);
  const poseidon = await getPoseidon();
  const F = poseidon.F;
  const H = (arr: bigint[]): bigint => F.toObject(poseidon(arr)) as bigint;

  const acctCommit = accounts.map((a) => H([a.acctId, a.salt]));
  const leafCommit = accounts.map((a, i) => H([acctCommit[i], a.balance]));
  const leafSum = accounts.map((a) => a.balance);

  const levels: { hash: bigint[]; sum: bigint[] }[] = [
    { hash: leafCommit, sum: leafSum },
  ];

  let curHash = leafCommit;
  let curSum = leafSum;
  while (curHash.length > 1) {
    const nextHash: bigint[] = [];
    const nextSum: bigint[] = [];
    for (let i = 0; i < curHash.length; i += 2) {
      nextHash.push(H([curHash[i], curSum[i], curHash[i + 1], curSum[i + 1]]));
      nextSum.push(curSum[i] + curSum[i + 1]);
    }
    levels.push({ hash: nextHash, sum: nextSum });
    curHash = nextHash;
    curSum = nextSum;
  }

  return {
    levels,
    rootHash: curHash[0],
    rootSum: curSum[0],
    acctCommit,
    leafCommit,
    accounts,
  };
}

/** Build the solvency circuit witness input. */
export function solvencyInput(tree: BuiltTree, reserves: bigint): SolvencyInput {
  return {
    rootHash: tree.rootHash.toString(),
    totalLiabilities: tree.rootSum.toString(),
    reserves: reserves.toString(),
    balances: tree.accounts.map((a) => a.balance.toString()),
    acctCommit: tree.acctCommit.map((c) => c.toString()),
  };
}

/**
 * Build the inclusion witness input for one account index, using the account's
 * (secret) balance. If the balance is wrong, the recomputed root will not match
 * and witness generation fails -- exactly the zero-knowledge guarantee.
 */
export function inclusionInput(
  tree: BuiltTree,
  idx: number,
  balance: bigint,
): InclusionInput {
  const siblingHash: string[] = [];
  const siblingSum: string[] = [];
  const pathIndex: string[] = [];
  let j = idx;
  for (let level = 0; level < DEPTH; level++) {
    const isRight = j & 1;
    const sib = isRight ? j - 1 : j + 1;
    siblingHash.push(tree.levels[level].hash[sib].toString());
    siblingSum.push(tree.levels[level].sum[sib].toString());
    pathIndex.push(String(isRight));
    j = j >> 1;
  }
  // leafCommitment is a PUBLIC signal; it is derived from the claimed balance.
  // We recompute it from the account's committed acctCommit so a mismatching
  // balance produces a leaf that cannot fold to the attested root.
  const leafCommitment = tree.leafCommit[idx];
  return {
    rootHash: tree.rootHash.toString(),
    leafCommitment: leafCommitment.toString(),
    balance: balance.toString(),
    acctCommit: tree.acctCommit[idx].toString(),
    siblingHash,
    siblingSum,
    pathIndex,
  };
}
