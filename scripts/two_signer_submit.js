#!/usr/bin/env node
// two_signer_submit.js -- full N-signer Soroban submit for testnet ops (#59).
//
// Problem: `stellar contract invoke` (CLI 26.1.0) accepts `--sign-with-key`
// only ONCE, so a call needing TWO distinct require_auth signatures (e.g.
// submit_multi_attestation with two leg holders) cannot be sent by the CLI
// alone. Naive `tx sign` chaining fails too: it appends ENVELOPE signatures,
// but Soroban needs per-entry AUTHORIZATION signatures (A+B envelope sigs ->
// TxBadAuthExtra; B-only -> TxBadAuth).
//
// This script does the complete flow with @stellar/stellar-sdk v16:
//   1. load `--build-only` unsigned XDR, rebuild with timebounds
//   2. simulate + assemble (attaches auth entries + footprint)
//   3. authorize EACH auth entry with its holder's key (entry-level signature)
//   4. envelope-sign with the source account, send, poll to SUCCESS
//
// Keys: derived in-memory from the local Stellar keystore seed phrases via
// scripts/slip10.js (BIP39+SLIP-10, verified against `stellar keys address`).
// Secrets are NEVER logged, written, or exported — only signatures leave.
//
// Usage:
//   UNSIGNED_XDR=/tmp/multi_unsigned.xdr \
//   SIGNERS=tessera-holder-a,tessera-holder-b \
//   node scripts/two_signer_submit.js
// Prints TX_HASH=<hash> and LEDGER=<n> on success.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { mnemonicToSeed } = require("./slip10.js");

let StellarSdk;
try {
  StellarSdk = require("@stellar/stellar-sdk");
} catch {
  StellarSdk = require(path.join(__dirname, "..", "frontend", "node_modules", "@stellar", "stellar-sdk"));
}

const RPC_URL = process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;

function keypairOf(identity) {
  const toml = fs.readFileSync(
    path.join(os.homedir(), ".config/stellar/identity", `${identity}.toml`), "utf8");
  const m = toml.match(/seed_phrase\s*=\s*"([^"]+)"/);
  if (!m) throw new Error(`no seed_phrase in identity ${identity}`);
  return StellarSdk.Keypair.fromRawEd25519Seed(mnemonicToSeed(m[1]));
}

(async () => {
  const unsignedPath = process.env.UNSIGNED_XDR;
  const signers = (process.env.SIGNERS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!unsignedPath || signers.length < 2) {
    console.error("usage: UNSIGNED_XDR=<xdr> SIGNERS=a,b[,c] node scripts/two_signer_submit.js");
    process.exit(1);
  }
  const kps = new Map(signers.map((id) => {
    const kp = keypairOf(id);
    return [kp.publicKey(), kp];
  }));

  const server = new StellarSdk.rpc.Server(RPC_URL);
  const bare = StellarSdk.TransactionBuilder.fromXDR(
    fs.readFileSync(unsignedPath, "utf8").trim(), PASSPHRASE);
  const tx = StellarSdk.TransactionBuilder.cloneFrom(bare, {
    fee: bare.fee, networkPassphrase: PASSPHRASE,
  }).setTimeout(300).build();

  console.log("simulating...");
  const sim = await server.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    console.error("simulation failed:", JSON.stringify(sim).slice(0, 400));
    process.exit(2);
  }
  const assembled = StellarSdk.rpc.assembleTransaction(tx, sim).build();
  const latest = await server.getLatestLedger();
  const validUntil = latest.sequence + 60;

  // Entry-level authorization: each Soroban auth entry signed by ITS address key.
  const op = assembled.operations[0];
  const auths = op.auth || [];
  if (auths.length === 0) throw new Error("no auth entries assembled — nothing to authorize");
  for (let i = 0; i < auths.length; i++) {
    // Source-account credentials are covered by the envelope signature below.
    // Address credentials need an entry-level signature from THAT address key.
    const sw = auths[i].credentials().switch().name;
    if (sw === "sorobanCredentialsSourceAccount") {
      console.log(`entry ${i}: source-account credentials (envelope covers)`);
      continue;
    }
    const addr = StellarSdk.Address.fromScAddress(
      auths[i].credentials().address().address()).toString();
    const kp = kps.get(addr);
    if (!kp) throw new Error(`no local key for auth address ${addr} (have: ${[...kps.keys()].join(",")})`);
    op.auth[i] = await StellarSdk.authorizeEntry(auths[i], kp, validUntil, PASSPHRASE);
    console.log(`authorized entry ${i} as ${addr}`);
  }

  // Envelope signature from the source account.
  const sourceKp = kps.get(assembled.source);
  if (!sourceKp) throw new Error(`source ${assembled.source} not in SIGNERS`);
  assembled.sign(sourceKp);

  console.log("sending...");
  const send = await server.sendTransaction(assembled);
  if (send.status !== "PENDING") {
    console.error("send failed:", JSON.stringify(send).slice(0, 400));
    process.exit(3);
  }
  let res = await server.getTransaction(send.hash);
  for (let i = 0; i < 30 && res.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    res = await server.getTransaction(send.hash);
  }
  console.log("TX_HASH=" + send.hash);
  console.log("STATUS=" + res.status);
  if (res.status !== "SUCCESS") {
    console.error(JSON.stringify(res).slice(0, 800));
    process.exit(4);
  }
  console.log("LEDGER=" + res.ledger);
})().catch((e) => { console.error("FATAL:", e.message || e); process.exit(5); });
