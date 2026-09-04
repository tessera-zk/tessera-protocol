# Production trusted-setup ceremony plan (issue #9)

Status: **plan + verification scripts. Production ceremony itself is NOT-YET.**

Current (disclosed everywhere): Groth16 phase-1 = public Hermez ptau
(`powersOfTau28_hez_final_*.ptau`); phase-2 = single-contributor
(`snarkjs zkey new` + contribute). A malicious setup could forge proofs for
any statement, including false key sets — this caveat applies to EVERY
"cannot forge / cannot omit" claim (ADVANCED-STATUS.md).

## Production bar

- Phase-1: keep Hermez (public, widely witnessed). Verify hash before use
  (`scripts/verify_ptau.sh`).
- Phase-2: multi-party ceremony, ≥3 independent contributors, each on
  air-gapped hardware, sequential `snarkjs zkey contribute` with fresh entropy,
  transcript hashes published per contribution.
- Per-circuit `.zkey` + `verification_key.json` published with hashes;
  anyone re-runs `scripts/verify_zkey.sh` to check the chain.
- Ceremony transcript + participant attestations committed to this repo
  (`docs/SETUP-REPRODUCIBILITY.md` record format).

## Steps (when scheduled)

1. Freeze circuits (`solvency`, `signed_solvency`, `risk_solvency`,
   `inclusion`) — any circuit change restarts phase-2.
2. Fetch + verify Hermez ptau for each power (15/16/19).
3. Contributor 1: `snarkjs groth16 setup r1cs ptau ckt_0000.zkey`.
4. Contributors 1..N: `snarkjs zkey contribute ckt_000k.zkey ckt_000k+1.zkey`
   (publish hash after each).
5. `snarkjs zkey verify r1cs ptau ckt_final.zkey`.
6. Export + embed vkeys (`contracts/scripts/convert.js` flow), redeploy.
7. Publish transcript; update `SECURITY.md` + circuits README disclosure.

## What this PR adds

- This plan, `verify_ptau.sh`, `verify_zkey.sh`, reproducibility record,
  `SECURITY.md`, disclosure note. No ceremony run, no new keys.
