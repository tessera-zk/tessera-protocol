# Red-team FAQ (issue #44)

## "Could the issuer hide a negative balance?"

No — every leaf is `Num2Bits(64)` range-checked in-circuit. A negative
(field-wrapped) value has no 64-bit representation, so witness generation
fails and no proof exists. Measured on the unified circuit
(`UNIFIED-NEGATIVE-CONTROL.md`; the EdDSA assert fires first on unsigned
leaves, the range assert fires on negatives — both unsatisfiable).

## "Could the issuer overstate reserves?"

Not past the live balance: the contract reads `balance(holder, token)`
cross-contract and rejects (`#5`) any declaration above it. It could
UNDERSTATE reserves (conservative, harmless to holders).

## "Could the issuer omit a member?"

An unregistered member: yes — nothing catches that (Vitalik's own caveat,
disclosed). A REGISTERED member: the proof's public keys are pinned
position-by-position; omission is rejected on-chain (#10, demonstrated).

## "Could a whale hide via leaf-splitting?"

Against the LIVE risk circuit: yes — the cap is per-leaf (disclosed FIX 3
scope). Against the keyed prototype: only via a second registered key
(Sybil — policy doc governs, mechanism does not).

## "Could a malicious setup forge everything?"

Yes — phase-2 is single-contributor (disclosed everywhere). This is the
highest-severity trust assumption and the reason the ceremony is P0.

## "Could the frontend leak commitments?"

Proving runs in-browser (snarkjs WASM); commitments never leave the tab.
The treasury signing key is server-side only (`TESSERA_TREASURY_SECRET`,
CI-gated). A compromised frontend build could exfiltrate — same as any web
app; verify the deployment you use.

## "Are the benchmark numbers real?"

Depth-4/8 rows are measured (`BENCHMARKS.md`, reproduce via `bench.sh`).
Depth-10 numbers are extrapolated and LABELED as such. Unified 42,344 is
measured (`r1cs info`).
