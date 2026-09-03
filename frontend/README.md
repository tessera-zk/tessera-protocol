# Tessera — Frontend

A real web app for the Tessera attestation system. Proofs are generated
**client-side** with snarkjs (WASM) and verified **on-chain** by the deployed
Soroban contract on Stellar testnet. No mocked proofs, no fake tx hashes, no
hardcoded results: every proof is computed in the browser and every write is a
real transaction.

Four views:

- **Attest** (`/attest`) - build a commitment set (canonical sample, inline
  edits, or CSV upload), build the Merkle-sum tree in-browser, generate the
  Groth16 attestation proof with snarkjs, encode it to the Soroban byte layout, and
  submit `submit_attestation`. Shows the real tx hash, ledger, and a Horizon
  confirmation.
- **Ledger** (`/ledger`) - reads `get_attestation()` / `epoch_count()`
  (read-only simulation) and shows total commitments, treasury, health ratio,
  timestamp, root hash, treasury-control status, member non-omission status, and
  a HEALTHY / UNDERFUNDED verdict.
- **Safety** (`/safety`) - reads the fixed core contract state and shows
  verified evidence for member self-enrollment, `submit_signed_attestation`,
  risk limits, and same-unit treasury aggregation. Rejection paths are labeled as
  simulation traps or no-witness cases, not fake tx hashes.
- **Membership** (`/membership`) - a member enters their own commitment; the app
  builds a Merkle-sum inclusion proof in-browser and calls `verify_inclusion`
  against the on-chain root, returning true/false. The commitment never leaves the
  tab; only the proof does.
- **Developers** (`/developers`) - embeddable health badge + `/api/solvency` JSON endpoint.

## Deployed contract (live, testnet)

| Item | Value |
|---|---|
| Contract ID | `CBTN433JB2LSFHPLGEZTLEW43IKKXPKN5AYHJVMLKO4NN6EQNBVDRJP4` |
| Network | Stellar testnet, Protocol 27 |
| RPC | `https://soroban-testnet.stellar.org` |
| Horizon | `https://horizon-testnet.stellar.org` |

Base interface: `submit_attestation(proof: BytesN<256>, public_signals: Vec<BytesN<32>>) -> u32`,
`verify_inclusion(proof, public_signals) -> bool`,
`get_attestation() -> Option<Attestation>`, `epoch_count() -> u32`.

Advanced reads used by `/safety`: `registered_key_count`, `registered_keys`,
`signed_epoch`, `get_risk_attestation`, `reserve_legs`, `aggregate_reserves`,
and `get_multi_attestation`.

## Prerequisites

Use standard PATH-resolved binaries (CI-friendly):

```bash
NODE=$(which node)
NPM=$(which npm)
```

## Install

Always install with `--ignore-scripts` (supply-chain hygiene):

```bash
cd frontend
$NODE $NPM install --ignore-scripts
```

The proving artifacts (`*.wasm`, `*.zkey`) and the canonical `sample-book.json`
are already committed under `public/` (copied from the circuits build). If you
rebuild the circuits, re-copy:

```bash
cp ../build/solvency_js/solvency.wasm    public/circuits/solvency.wasm
cp ../build/inclusion_js/inclusion.wasm  public/circuits/inclusion.wasm
cp ../circuit-keys/solvency_final.zkey   public/circuits/solvency_final.zkey
cp ../circuit-keys/inclusion_final.zkey  public/circuits/inclusion_final.zkey
```

## Treasury signing key

Submitting an attestation is a real transaction and must be signed by a funded
testnet account. The signing key is held **server-side only** and NEVER reaches
the browser bundle: the `/api/submit-attestation` route handler reads
`TESSERA_TREASURY_SECRET` from `frontend/.env.local` and signs there. The browser only
computes the proof and posts the proof + public signals to that route.

Put the secret in `frontend/.env.local` (gitignored, non-`NEXT_PUBLIC_` so it is
never inlined into the client bundle). Never hardcode it, never paste it into a
UI field, never use a mainnet key:

```bash
# frontend/.env.local
TESSERA_TREASURY_SECRET=<funded testnet secret, e.g. from `stellar keys show tessera-treasury`>
```

The ledger, safety, and membership views need no key. They use read-only
simulation. Advanced write paths are shown from verified testnet evidence and
the reproduction scripts because member registration and multi-leg control
require the relevant member or treasury-holder authorizations.

## Run

```bash
# put TESSERA_TREASURY_SECRET in frontend/.env.local first (see above)
export PATH=$(which node):$PATH
node ./node_modules/next/dist/bin/next dev -p 3007
# open http://localhost:3007
```

Typecheck:

```bash
$NODE ./node_modules/typescript/bin/tsc --noEmit
```

## Advanced evidence shown in the UI

- Member self-enrollment set: four real `register_customer_key` txs
  (`ad1de0c...`, `7909650...`, `37adc52...`, `f2ba9d3...`).
- Honest in-circuit signed attestation: real `submit_signed_attestation` tx
  `cec46e6cfdba18d6bfefdb61633d017aa6a0be66ff38e90cae231f87ae6ee7ef`.
- Omission attempt: rejected during Soroban simulation with `Error #10`
  (`RegisteredSetMismatch`). No ledger tx exists because nothing is stored.
- Replay attempt: rejected with `Error #14` (`StaleEpoch`).
- Same-unit treasury aggregation: real `set_reserve_legs` tx
  `b124a9c3bfde87442a7be394cd567047b5096f062d79334782d2f37f39684cd3`
  and real `submit_multi_attestation` tx
  `f8631c7019f91980fc4411868f7832bb815bcf7bff5583f69074a39f0e85ac4a`.
- Non-1:1 reserve scale: rejected with `Error #13` (`BadReserveLeg`).

## How the private data stays private

Commitments are only ever used as snarkjs witness inputs in the browser. What leaves
the tab is the 256-byte Groth16 proof plus the public signals (`rootHash`,
`totalCommitments`, `treasury` for solvency; `rootHash`, `leafCommitment` for
membership). The byte encoding (`lib/convert.ts`) matches the on-chain
`from_bytes` layout exactly (G1 = `x||y`, G2 imaginary-component-first, proof =
`A||B||C`).

## Notes and scope

- Depth-4 tree (up to 16 accounts), matching the deployed circuits. The attestation
  view reproduces the exact on-chain root when using the canonical sample book.
- `NOT-YET`: browser wallet signing via Freighter / Stellar Wallets Kit. The
  attestation flow signs with a server-side `TESSERA_TREASURY_SECRET` in `.env.local`. Reads
  need no wallet. Wiring a wallet-kit connector is a drop-in follow-up.
- Multi-treasury is same-unit only. Non-1:1 scales are deliberately rejected.
- Risk concentration is per leaf, not per member.
- Stack: Next.js App Router, TypeScript, Tailwind v4, `@stellar/stellar-sdk` v16
  (Protocol 23+ meta), `snarkjs`, `circomlibjs`.