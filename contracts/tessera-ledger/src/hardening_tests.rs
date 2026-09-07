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
