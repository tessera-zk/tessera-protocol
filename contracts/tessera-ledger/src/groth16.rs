//! BN254 Groth16 verification core.
//!
//! Forked from the Nethermind stellar-private-payments
//! `circom-groth16-verifier` (Apache-2.0). The pairing-check logic is
//! unchanged; only the surface (byte-oriented proof input, two embedded
//! verification keys) is adapted for tessera-ledger.
//!
//! Pairing check:
//!   e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) == 1
//! where vk_x = IC[0] + sum_i public_i * IC[i+1].

use soroban_sdk::{
    contracterror, vec, BytesN, Env, Vec,
    crypto::bn254::{Bn254Fr, Bn254G1Affine as G1Affine, Bn254G2Affine as G2Affine},
};

/// Errors returned by the Groth16 verifier.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Groth16Error {
    /// The pairing product did not equal identity: the proof is invalid.
    InvalidProof = 0,
    /// The number of public inputs does not match the verification key.
    MalformedPublicInputs = 1,
}

/// A parsed BN254 Groth16 proof (A in G1, B in G2, C in G1).
pub struct Groth16Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

impl Groth16Proof {
    /// Parse a 256-byte proof: A(64) || B(128) || C(64).
    pub fn from_bytes(env: &Env, bytes: &BytesN<256>) -> Groth16Proof {
        let raw = bytes.to_array();
        let mut a = [0u8; 64];
        let mut b = [0u8; 128];
        let mut c = [0u8; 64];
        a.copy_from_slice(&raw[0..64]);
        b.copy_from_slice(&raw[64..192]);
        c.copy_from_slice(&raw[192..256]);
        Groth16Proof {
            a: G1Affine::from_bytes(BytesN::from_array(env, &a)),
            b: G2Affine::from_bytes(BytesN::from_array(env, &b)),
            c: G1Affine::from_bytes(BytesN::from_array(env, &c)),
        }
    }
}

/// A BN254 Groth16 verification key built from embedded byte constants.
pub struct VerificationKey {
    pub alpha: G1Affine,
    pub beta: G2Affine,
    pub gamma: G2Affine,
    pub delta: G2Affine,
    pub ic: Vec<G1Affine>,
}

impl VerificationKey {
    /// Build a verification key from the compile-time byte constants generated
    /// by `contracts/scripts/convert.js`.
    pub fn from_const(
        env: &Env,
        alpha: &[u8; 64],
        beta: &[u8; 128],
        gamma: &[u8; 128],
        delta: &[u8; 128],
        ic: &[[u8; 64]],
    ) -> VerificationKey {
        let mut ic_vec: Vec<G1Affine> = Vec::new(env);
        for pt in ic.iter() {
            ic_vec.push_back(G1Affine::from_bytes(BytesN::from_array(env, pt)));
        }
        VerificationKey {
            alpha: G1Affine::from_bytes(BytesN::from_array(env, alpha)),
            beta: G2Affine::from_bytes(BytesN::from_array(env, beta)),
            gamma: G2Affine::from_bytes(BytesN::from_array(env, gamma)),
            delta: G2Affine::from_bytes(BytesN::from_array(env, delta)),
            ic: ic_vec,
        }
    }
}

/// Verify a Groth16 proof against a verification key and public inputs.
///
/// Returns `Ok(true)` when the pairing check passes, `Err(InvalidProof)` when
/// it fails, and `Err(MalformedPublicInputs)` when the input length is wrong.
pub fn verify(
    env: &Env,
    vk: &VerificationKey,
    proof: &Groth16Proof,
    public_inputs: &Vec<Bn254Fr>,
) -> Result<bool, Groth16Error> {
    let bn = env.crypto().bn254();

    if public_inputs.len().checked_add(1) != Some(vk.ic.len()) {
        return Err(Groth16Error::MalformedPublicInputs);
    }

    // vk_x = IC[0] + sum_i public_i * IC[i+1]
    let mut vk_x = vk.ic.get(0).ok_or(Groth16Error::MalformedPublicInputs)?;
    for i in 0..public_inputs.len() {
        let s = public_inputs
            .get(i)
            .ok_or(Groth16Error::MalformedPublicInputs)?;
        let ic_idx = i.checked_add(1).ok_or(Groth16Error::MalformedPublicInputs)?;
        let v = vk
            .ic
            .get(ic_idx)
            .ok_or(Groth16Error::MalformedPublicInputs)?;
        let prod = bn.g1_mul(&v, &s);
        vk_x = bn.g1_add(&vk_x, &prod);
    }

    #[allow(clippy::arithmetic_side_effects)]
    let neg_a = -proof.a.clone();

    let g1_points = vec![env, neg_a, vk.alpha.clone(), vk_x, proof.c.clone()];
    let g2_points = vec![
        env,
        proof.b.clone(),
        vk.beta.clone(),
        vk.gamma.clone(),
        vk.delta.clone(),
    ];

    if bn.pairing_check(g1_points, g2_points) {
        Ok(true)
    } else {
        Err(Groth16Error::InvalidProof)
    }
}
