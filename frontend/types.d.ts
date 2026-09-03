// The ZK libraries ship no TypeScript declarations. They are only ever imported
// dynamically on the client; we treat their surfaces as `any` and wrap them in
// the typed helpers in lib/merkle.ts, lib/prover.ts.
declare module "circomlibjs";
declare module "snarkjs";
declare module "@creit.tech/stellar-wallets-kit";
declare module "@creit.tech/stellar-wallets-kit/modules/utils";