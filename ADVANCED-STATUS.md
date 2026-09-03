# Advanced upgrades + adversarial-audit fixes

Three upgrades layered on the deployed Tessera contract (in-circuit
non-omission, multi-holder reserves, risk limits), hardened by a round of
adversarial-audit fixes that closed real ZK-soundness holes. Everything here is
real: real circom/Groth16 circuits on BN254, real proofs, real Soroban code
unit-tested against real token balances, and real Stellar testnet transactions
(every hash re-queryable on Horizon, `successful=true`).

Headline: **an issuer can no longer omit a member from the commitments set.**
The registered-member set is now built by the MEMBERS themselves (each key
self-registered under the member's own authorization) and pinned on-chain,
position-by-position, against the signer keys a signed-attestation proof exposes as
public inputs. An attestation over a set missing a registered member is
**rejected on-chain** (demonstrated below, `Error #10`). This holds under one
disclosed trust assumption: the Groth16 phase-2 setup is single-contributor, so a
malicious setup could forge proofs — a production deployment needs an MPC ceremony.

## Adversarial-audit fixes (this round)

| # | Hole found | Fix shipped | Enforcement |
|---|---|---|---|
| **1** | `set_registered_set(pubkeyHash)` let the ISSUER author the registered-key commitment under its own auth, so it could commit to `Poseidon(subset)` and omit member C. | Removed the issuer-authored hash. Each member calls `register_customer_key(customer, ax, ay)` under `customer.require_auth()`; the circuit now exposes each leaf's signer key `(Ax_i, Ay_i)` as a PUBLIC input; `submit_signed_attestation` pins those public keys against the ordered self-registered list. | On-chain `Error #10` (RegisteredSetMismatch) |
| **2** | `ReserveLeg.scale_num/scale_den` were arbitrary issuer i128, so an issuer could mint a worthless SAC and scale it up to fake backing. | `set_reserve_legs` now rejects any non-1:1 scale. Relabelled honestly as **multi-holder, same-unit aggregation** (no issuer-set price). Cross-asset backing via a real oracle (Reflector) is NOT-YET. | On-chain `Error #13` (BadReserveLeg) |
| **3** | Risk-circuit `acctCommit[]` unconstrained, so a whale splits across leaves to evade the per-leaf concentration cap. | **Honestly downgraded** in all docs + code comments: the cap is PER-LEAF, not per-member. Sound per-member concentration needs FIX 1's keyed leaves merged into the risk circuit (NOT-YET). No overclaim remains. | documented scope |
| **4** | A stale signed proof could be replayed to re-show old (smaller) commitments; risk/multi paths never updated `Latest`, so `verify_inclusion` bound to a stale root. | `submit_signed_attestation` binds the circuit `epoch` to a monotonic on-chain counter (strictly increasing). `submit_risk_attestation` + `submit_multi_attestation` now also write `Latest`. | On-chain `Error #14` (StaleEpoch) |
| **5** | Non-canonical public field elements could alias via silent mod-reduction (M3); frontend README leaked a `NEXT_PUBLIC_` signing key; dead ternary; silent multi-asset overflow. | Canonical-range assert (`< r`) on every public signal before `g1_mul`; README fixed to server-side `TESSERA_TREASURY_SECRET` only; dead ternary removed; multi-asset overflow is an explicit error. | `Error #16` / `#15`, code |

## Authoritative deployment (Stellar testnet, Protocol 27)

Redeployed with the fixed interface (`register_customer_key` replaces
`set_registered_set`; signed-attestation public signals grew from 5 to 12).

| Item | Value |
|---|---|
| Contract ID (all upgrades + fixes) | `CDGNPPPT4YSTUTZ4NFNKMWJXUEVHU5CPDR57EI644LBLKUQX2LOLYHTK` |
| Wasm sha256 | `52c5d4b1c8fc4dce4a097d85bc90b683912f4bdf2619748a8af88ba48e2f986f` |
| Reserve holder (immutable) | `zk-reserve` = `GBKY7FXTESEV6ON5FGMKOIB57OFFAXQT2BMBE2KEHYQPRAT4JQASNUJC` |
| Reserve token (SAC) | `CCJZEZSWDJTBAVSPCNRWTDPB4DYHC22UW7D6TI65MX4CFTTD32LEHLFD` (USDC test asset) |
| Issuer / deployer | `zk-deployer` = `GBZK7Z6DMDBVFOURA76RXRQKPIHXTJFGN6CVRMU3J6ZE55YCZBHG3XG2` |
| Explorer | https://stellar.expert/explorer/testnet/contract/CDGNPPPT4YSTUTZ4NFNKMWJXUEVHU5CPDR57EI644LBLKUQX2LOLYHTK |

Four independent member identities self-registered their Baby-JubJub keys
(`por-cust-a..d`): `GCBANVPN…`, `GA5HMIWI…`, `GDM37XTC…`, `GDCBAGVU…`.

### Every transaction (submitted txs `successful=true` on Horizon)

| Action | Tx hash | Ledger |
|---|---|---|
| Deploy instance (binds holder + token) | `0c53e8967ff6a6334b34fd622460ca8fcac40c5231375c4411eba5c94ab40be5` | — |
| **FIX 1** member A self-registers key | `ad1de0c86ada35429326e72786d0c1e2ae73555b82c1b59b4145407f1c84c54b` | — |
| **FIX 1** member B self-registers key | `7909650e89250dc356aaaae354ed759bfd0a3dd231921014cc89910d4e6d9e82` | — |
| **FIX 1** member C self-registers key | `37adc527615f1c5efdbec771e2e2b41877dac95ecdfa74ef7da1f13db6b11d4a` | — |
| **FIX 1** member D self-registers key | `f2ba9d3518bdb559631ec3db73e9080857765d37957bfc197058cdd59e33d591` | — |
| **FIX 1** `submit_signed_attestation` HONEST (verified on-chain, stored, non_omission_in_circuit=true) | `cec46e6cfdba18d6bfefdb61633d017aa6a0be66ff38e90cae231f87ae6ee7ef` | 3396983 |
| **FIX 1** OMISSION proof (valid proof, filler key at slot C) → rejected | on-chain `Error #10` (simulation trap; nothing stored) | — |
| **FIX 4** replay HONEST proof (same epoch 0) → rejected | on-chain `Error #14` | — |
| **FIX 2** `set_reserve_legs` non-1:1 scale → rejected | on-chain `Error #13` | — |
| **FIX 2** `set_reserve_legs` 1:1 same-unit leg | `b124a9c3bfde87442a7be394cd567047b5096f062d79334782d2f37f39684cd3` | — |
| **FIX 2** `submit_multi_attestation` (reserves bound to aggregate 189140) | `f8631c7019f91980fc4411868f7832bb815bcf7bff5583f69074a39f0e85ac4a` | 3396986 |

`get_attestation` right after the honest signed submit returned
`non_omission_in_circuit=true, control_proven=true`; the later
`submit_multi_attestation` overwrites `Latest` with its own root (FIX 4: risk/multi
now also write `Latest`), so a post-multi read shows the multi attestation.

The omission / replay / bad-scale rejections fail in `transaction simulation`
(the contract logic runs against live on-chain state and traps with the mapped
error) so nothing is stored — the standard way a Soroban invoke surfaces a
contract error. The honest, set-legs, and multi calls are fully submitted txs.

### Contract test suite

`cargo test -p tessera-ledger` → **25 passed, 0 failed**, including the new
FIX-1 self-registration + on-chain omission rejection, FIX-4 stale-epoch replay
rejection, and FIX-2 non-1:1-scale rejection.

## Circuits: constraints + proving

| Circuit | Constraints (non-linear) | ptau | Public signals |
|---|---:|---|---|
| `signed_solvency` (FIX 1, depth 2, 4 in-circuit EdDSA sigs) | ~34,300 | 2^16 Hermez | `[root, total, reserves, epoch, Ax[0..3], Ay[0..3]]` (12) |
| `signed_inclusion` (depth 2) | 2,066 | 2^15 Hermez | `[root, leafCommitment]` |
| `risk_solvency` (UP3, depth 4, 16 leaves) | ~22,094 | 2^15 Hermez | `[root, total, reserves, maxConcBps, minCollBps]` |
| `solvency` (base, depth 4) | 20,511 | 2^15 Hermez | `[root, total, reserves]` |

`signed_solvency` uses the larger **2^16** Hermez ptau
(`powersOfTau28_hez_final_16.ptau`) because in-circuit Baby-JubJub EdDSA is heavy.
Rebuild it with `scripts/build_signed.sh`.

---

## FIX 1 (HIGHEST VALUE) — member-verifiable, issuer-uncontrollable non-omission

### The hole

The prior design published `pubkeyHash = Poseidon(all registered keys)` via
`set_registered_set`, authorized by the reserve holder (issuer). The issuer could
therefore publish `Poseidon(keys of A, B, D)` and prove health over `{A, B, D}`,
silently omitting member C. The "registered set" was issuer-controlled, so the
non-omission guarantee was circular.

### The fix

1. **Members author the set.** `register_customer_key(customer, ax, ay)` requires
   `customer.require_auth()`. Each member appends their own Baby-JubJub public key
   to an on-chain ordered list. The issuer never authors or alters it. Any member
   confirms membership with `is_registered_key(ax, ay) -> bool` and
   `registered_key_count()`.
2. **Keys are public in the proof.** `signed_solvency.circom` now exposes each
   leaf's signer key `(Ax_i, Ay_i)` as a PUBLIC input (the single issuer-authored
   `pubkeyHash` is gone). The circuit still verifies every leaf's EdDSA signature
   in-circuit and binds `acctCommit_i = Poseidon(Ax_i, Ay_i, nonce_i)` into leaf `i`.
3. **The contract pins keys to the self-registered list.** `submit_signed_attestation`
   requires the proof's public keys to equal the registered list, position-by-position.
   An attestation whose signer keys are not exactly the registered keys → `Error #10`.

So an omitting issuer CAN still build a valid proof over a substituted key set (it
signs its own filler leaf), but the on-chain pin rejects it because the filler key
at slot C ≠ the registered C key. Non-omission is enforced ON-CHAIN, tied to a set
the issuer cannot author.

### Testnet demonstration

- Four members self-registered (`por-cust-a..d`), `registered_key_count() = 4`.
- HONEST `submit_signed_attestation` → success; `get_attestation()` (read right
  after) returned `non_omission_in_circuit: true`, `control_proven: true`,
  `reserves = 0x7530 = 30000`, `total = 0x6d60 = 28000`, `signed_epoch() = 0`. Tx
  `cec46e6c…`, ledger 3396983, Horizon `successful=true`.
- OMISSION proof (dropped C, issuer filler key in slot C — a valid Groth16 proof)
  → `Error #10` on-chain. `is_registered_key(filler_key)` returns `false`.

### Trust model (honest)

Non-omission now reduces to: each member performs a **one-time self-registration**
of their key (a tx they sign), and the registered list is public and issuer-
uncontrollable. Given that, an attestation missing a registered member is rejected
on-chain. **Single-contributor-trusted-setup caveat:** the Groth16 phase-2 setup is
a disclosed single contribution, so a MALICIOUS setup could forge a proof for any
statement (including a false key set); production needs a multi-party ceremony.
Phase-1 is the public Hermez ptau.

The prior on-chain-ed25519 tier (`register_signed_leaves` / `verify_signed_claim`,
Stellar-key signatures re-checked by the contract) is retained and still passes its
tests; it is the weaker, vigilance-based tier that this fix supersedes.

---

## FIX 2 — Multi-holder, same-unit reserves (no issuer-set price)

`ReserveLeg` still carries `scale_num/scale_den`, but `set_reserve_legs` now rejects
any non-1:1 scale (`Error #13`): an issuer can no longer inflate a worthless token's
contribution with an arbitrary price. The feature is now honestly **multi-holder,
same-unit aggregation** — every leg's token must be denominated in the same unit as
the declared reserves (e.g. several USDC accounts). `aggregate_reserves()` sums the
live balances directly; overflow is an explicit `Error #15`, never a silent fallback.

### Testnet demonstration

- `set_reserve_legs` with `scale 2/1` → `Error #13` (rejected).
- `set_reserve_legs` with a 1:1 leg (`zk-reserve`, USDC) → tx `b124a9c3…`.
- `aggregate_reserves()` = 189140. `submit_multi_attestation` (base health proof,
  reserves 189140) → tx `f8631c70…`, ledger 3396986, event `attest/multi`,
  aggregate 189140, `leg_count 1`. `successful=true`.

### Trust model + NOT-YET

Backing = sum of live, same-unit, controlled balances (each leg holder `require_auth`s).
This is a fact about chain state, not a prover assertion. **Cross-asset** backing
(different tokens at real prices) needs an on-chain oracle: **Reflector** (Stellar's
oracle) is the intended integration and is NOT-YET wired — deliberately, rather than
keep an issuer-set price that fakes soundness.

---

## FIX 3 — Concentration cap is PER-LEAF (honest downgrade)

The risk circuit proves, per leaf, `balance_i * 10000 <= maxConcBps * totalLiabilities`,
and `reserves * 10000 >= minCollBps * totalLiabilities`. Both bounds are public.

**Honest scope:** the concentration cap is **per-LEAF, not per-member.** The risk
circuit's leaves are not bound to registered member keys, so a whale can SPLIT its
balance across several leaves to stay under the per-leaf cap. A sound per-member cap
requires FIX 1's keyed leaves (one keyed leaf per registered member, keys pinned
on-chain) merged into the risk circuit, or balances aggregated per key before the
test. That merge is **NOT-YET**. The claim has been downgraded everywhere (contract
`RiskAttestation` doc, `submit_risk_attestation` doc, and the circuit template header)
so nothing overclaims per-member concentration. Min-collateralization is unaffected
and remains sound.

---

## FIX 4 — Freshness / replay

`submit_signed_attestation` reads the circuit `epoch` (a public input each member's
signature is bound to) and requires it to be **strictly greater** than the last
accepted signed epoch (stored in `DataKey::SignedEpoch`, exposed via `signed_epoch()`).
Replaying a stale proof with an old epoch → `Error #14`. Demonstrated: submitting the
honest proof twice — the second (same epoch 0) is rejected `#14`.

`submit_risk_attestation` and `submit_multi_attestation` now also write `DataKey::Latest`,
so `verify_inclusion` always binds to the current certified-healthy root (closes M2).

---

## FIX 5 — Canonical range, secret hygiene, dead code, explicit overflow

- **Canonical field elements (M3):** every Groth16 public signal is checked `< r`
  (BN254 scalar modulus) before it reaches `g1_mul`; a non-canonical encoding →
  `Error #16`. Applied to all four proof-consuming entrypoints and to
  `register_customer_key`.
- **Secret hygiene (H2):** `frontend/README.md` now instructs `TESSERA_TREASURY_SECRET` in
  `frontend/.env.local` only (server-side, non-`NEXT_PUBLIC_`, never pasted into a
  UI field). The frontend already signs server-side; the README now matches.
- **Dead ternary (L1):** `app/issuer/page.tsx` total reducer simplified (the
  `a.balance < 0n ? a.balance : a.balance` no-op is gone).
- **Explicit overflow (L2):** multi-asset aggregation returns `Error #15` on i128
  overflow instead of a silent saturating fallback.

---

## Reproduce

```bash
NODE=$(which node)
# base circuits + ptau (2^15)
bash scripts/build.sh
# FIX 1 signed circuit: compile + 2^16 setup + prove honest + omission
bash scripts/build_signed.sh
bash scripts/prove_signed.sh            # honest + omission verify; forgery unprovable
$NODE contracts/scripts/convert_signed.js
# contract: 25 tests + wasm
cd contracts && cargo test -p tessera-ledger && stellar contract build && cd ..
# testnet (fresh instance): members self-register, honest passes,
#   omission #10 + replay #14 rejected
CONTRACT=<id> bash scripts/testnet_signed_demo.sh
```

## Honest blockers / NOT-YET

- **Trusted setup** — Groth16 phase-2 is single-contributor (disclosed non-ceremony).
  A malicious setup can forge proofs. Production needs an MPC ceremony. Phase-1 is the
  public Hermez ptau. This caveat applies to EVERY "cannot forge / cannot omit" claim.
- **Cross-asset reserves (FIX 2)** — only same-unit (1:1) aggregation is supported.
  Real multi-asset backing needs a Reflector oracle integration (not yet wired).
- **Per-member concentration (FIX 3)** — the risk cap is per-leaf; per-member needs
  FIX 1's keyed leaves merged into the risk circuit.
- **Fixed member count (FIX 1)** — the demo signed circuit is depth 2 (exactly 4
  registered members). A production system parameterizes depth and supports dynamic
  membership (add/remove) with a re-proof per epoch.
- **Segregation** — control (`require_auth`) is proven; segregated/unencumbered custody
  is not (control != segregation).