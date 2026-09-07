//! Boundary hardening tests (issue #40): canonical field-element edges.
//!
//! These pin the M3 defense (`is_canonical_fr` / `ge_be`): values the
//! contract must accept stay accepted, values `>= r` stay rejected. Pure
//! unit tests — no fixtures, no network.

use super::*;
use soroban_sdk::{BytesN, Env};

fn bytes(env: &Env, last: u8) -> BytesN<32> {
    let mut a = [0u8; 32];
    a[31] = last;
    BytesN::from_array(env, &a)
}

/// Zero is canonical.
#[test]
fn zero_is_canonical() {
    let env = Env::default();
    assert!(is_canonical_fr(&bytes(&env, 0x00)));
}

/// Small values are canonical.
#[test]
fn small_values_are_canonical() {
    let env = Env::default();
    assert!(is_canonical_fr(&bytes(&env, 0x01)));
    assert!(is_canonical_fr(&bytes(&env, 0xff)));
}

/// r - 1 (modulus minus one) is the largest canonical value.
#[test]
fn modulus_minus_one_is_canonical() {
    let env = Env::default();
    let mut m = BN254_FR_MODULUS;
    // subtract 1 (r is odd, low byte 0x01, no borrow chain)
    m[31] -= 1;
    assert_eq!(m[31], 0x00);
    assert!(is_canonical_fr(&BytesN::from_array(&env, &m)));
}

/// r itself is NOT canonical (boundary exclusion).
#[test]
fn modulus_itself_is_not_canonical() {
    let env = Env::default();
    let m = BytesN::from_array(&env, &BN254_FR_MODULUS);
    assert!(!is_canonical_fr(&m));
}

/// All-0xFF is NOT canonical (far above r).
#[test]
fn all_ff_is_not_canonical() {
    let env = Env::default();
    assert!(!is_canonical_fr(&BytesN::from_array(&env, &[0xff; 32])));
}

/// Documented error codes are stable: frontend maps, runbooks, and the audit
/// log all key off these numbers. Any renumber needs a coordinated change.
#[test]
fn adjudicated_error_codes_are_stable() {
    assert_eq!(Error::InvalidSolvencyProof as u32, 1);
    assert_eq!(Error::RegisteredSetMismatch as u32, 10); // FIX 1 omission
    assert_eq!(Error::BadReserveLeg as u32, 13); // FIX 2 same-unit
    assert_eq!(Error::StaleEpoch as u32, 14); // FIX 4 replay
    assert_eq!(Error::NonCanonicalSignal as u32, 16); // FIX 5 / M3
    assert_eq!(Error::ReserveUnbacked as u32, 5);
}

/// Every discriminant in 1..=22 is used at most once (no silent aliasing
/// between two error meanings).
#[test]
fn error_discriminants_are_unique() {
    let codes = [
        Error::InvalidSolvencyProof as u32,
        Error::MalformedPublicInputs as u32,
        Error::Insolvent as u32,
        Error::NoAttestation as u32,
        Error::ReserveUnbacked as u32,
        Error::ReservesOutOfRange as u32,
        Error::NotConfigured as u32,
        Error::BadSignedLeaf as u32,
        Error::EmptyRegistry as u32,
        Error::RegisteredSetMismatch as u32,
        Error::RegisteredSetNotSet as u32,
        Error::NoReserveLegs as u32,
        Error::BadReserveLeg as u32,
        Error::StaleEpoch as u32,
        Error::ReserveOverflow as u32,
        Error::NonCanonicalSignal as u32,
        Error::RootAlreadyAttested as u32,
        Error::RegisteredSetFull as u32,
        Error::CustomerAlreadyRegistered as u32,
        Error::WeakAttestationDowngrade as u32,
        Error::RiskPolicyTooWeak as u32,
        Error::BadReserveToken as u32,
    ];
    let mut sorted = codes;
    // no_std: manual uniqueness scan (no slice::sort in core-less alloc here).
    let mut i = 0;
    while i < sorted.len() {
        let mut j = i + 1;
        while j < sorted.len() {
            assert_ne!(sorted[i], sorted[j], "duplicate error discriminant");
            j += 1;
        }
        i += 1;
    }
}

/// Public-signal-count constants match the circuits they serve. A mismatch
/// here would verify proofs against the wrong arity (silent wrong-statement
/// risk), so the coupling is pinned by test.
#[test]
fn signal_count_consts_match_circuits() {
    assert_eq!(SOLVENCY_N_PUBLIC, 3); // [root, total, reserves]
    assert_eq!(INCLUSION_N_PUBLIC, 2); // [root, leafCommitment]
    assert_eq!(SIGNED_SOLVENCY_LEAVES, 4); // depth-2 demo: fixed member count
    assert_eq!(SIGNED_SOLVENCY_N_PUBLIC, 4 + 2 * SIGNED_SOLVENCY_LEAVES); // 12
    assert_eq!(SIGNED_SOLVENCY_N_PUBLIC, 12);
    assert_eq!(RISK_SOLVENCY_N_PUBLIC, 5); // [root, total, reserves, conc, coll]
}

/// `ge_be` comparator edges: equal, just-below, just-above at the low byte,
// plus a high-byte decision (lexicographic, big-endian).
#[test]
fn ge_be_edges() {
    let env = Env::default();
    let lo = |last: u8| -> BytesN<32> { bytes(&env, last) };
    assert!(ge_be(&lo(0x05), &lo(0x05))); // equal
    assert!(!ge_be(&lo(0x04), &lo(0x05))); // below
    assert!(ge_be(&lo(0x06), &lo(0x05))); // above
    let mut hi_a = [0u8; 32];
    let mut hi_b = [0u8; 32];
    hi_a[0] = 0x31;
    hi_b[0] = 0x30;
    hi_b[31] = 0xff; // low byte loses to high byte
    assert!(ge_be(
        &BytesN::from_array(&env, &hi_a),
        &BytesN::from_array(&env, &hi_b)
    ));
}
