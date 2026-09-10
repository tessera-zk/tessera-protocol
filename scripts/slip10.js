#!/usr/bin/env node
// slip10.js -- minimal BIP39 mnemonic -> SLIP-0010 ed25519 key derivation.
// Built ONLY on node:crypto (no new dependencies). Used by two_signer_submit.js
// to turn the local Stellar keystore seed phrases into signing keypairs.
// Path: m/44'/148'/{index} (index 0 default — matches `stellar keys generate`).
const crypto = require("crypto");

function hmacSHA512(key, data) {
  return crypto.createHmac("sha512", key).update(data).digest();
}

function masterKey(seed) {
  const I = hmacSHA512(Buffer.from("ed25519 seed", "ascii"), seed);
  return { secret: I.subarray(0, 32), chain: I.subarray(32) };
}

function ckdHardened(parent, index) {
  if (index < 0x80000000) throw new Error("only hardened derivation (SLIP-0010 ed25519)");
  const data = Buffer.concat([Buffer.from([0]), parent.secret,
    Buffer.from([(index >>> 24) & 0xff, (index >>> 16) & 0xff, (index >>> 8) & 0xff, index & 0xff])]);
  const I = hmacSHA512(parent.chain, data);
  return { secret: I.subarray(0, 32), chain: I.subarray(32) };
}

// mnemonic (BIP39 words) -> raw 32-byte ed25519 seed at m/44'/148'/{index}.
function mnemonicToSeed(mnemonic, index = 0) {
  const seed = crypto.pbkdf2Sync(
    Buffer.from(mnemonic.normalize("NFKD"), "utf8"),
    Buffer.from("mnemonic", "ascii"), 2048, 64, "sha512");
  let node = masterKey(seed);
  for (const level of [44 + 0x80000000, 148 + 0x80000000, index + 0x80000000]) {
    node = ckdHardened(node, level);
  }
  return Buffer.from(node.secret);
}

// Raw 32-byte ed25519 seed -> raw 32-byte public key (PKCS8 DER round-trip).
function pubkeyFromSeed(rawSeed) {
  const prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const priv = crypto.createPrivateKey({ key: Buffer.concat([prefix, rawSeed]), format: "der", type: "pkcs8" });
  const pub = crypto.createPublicKey(priv);
  const der = pub.export({ format: "der", type: "spki" });
  return der.subarray(der.length - 32); // raw 32 bytes
}

module.exports = { mnemonicToSeed, pubkeyFromSeed };
