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
    assert!(!is_canonical_fr(&BytesN::from_array(&env, &[0xff; 32]))));
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
    sorted.sort_unstable();
    let before = sorted.len();
    sorted.dedup();
    assert_eq!(sorted.len(), before, "duplicate error discriminant");
}
