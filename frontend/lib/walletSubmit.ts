"use client";

import {
  Account,
  BASE_FEE,
  Contract,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL, type SubmitResult } from "@/lib/stellar";
import { signWalletTransaction } from "@/lib/wallet";

function server(): rpc.Server {
  return new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });
}
function bytesScVal(bytes: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}
function signalsScVal(signals: Uint8Array[]): xdr.ScVal {
  return xdr.ScVal.scvVec(signals.map(bytesScVal));
}

export async function submitAttestationWithWallet(
  signer: string,
  proofBytes: Uint8Array,
  signalBytes: Uint8Array[],
): Promise<SubmitResult> {
  const srv = server();
  const account = await srv.getAccount(signer);
  const contract = new Contract(CONTRACT_ID);
  const built = new TransactionBuilder(account, {
    fee: (BigInt(BASE_FEE) * 1000n).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("submit_attestation", bytesScVal(proofBytes), signalsScVal(signalBytes)))
    .setTimeout(120)
    .build();

  let prepared;
  try {
    prepared = await srv.prepareTransaction(built);
  } catch (err) {
    throw new Error(
      "Preflight rejected the wallet-signed attestation. The connected wallet must be the reserve holder and the proof must verify. " +
        String((err as Error)?.message ?? err),
    );
  }

  const signedXdr = await signWalletTransaction(prepared.toXDR(), signer);
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sent = await srv.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new Error(`sendTransaction ERROR: ${JSON.stringify(sent.errorResult ?? sent)}`);
  }

  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const receipt = await srv.getTransaction(sent.hash);
    if (receipt.status === rpc.Api.GetTransactionStatus.NOT_FOUND) continue;
    if (receipt.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`Transaction ${sent.hash} failed on-chain: ${receipt.status}`);
    }
    let epoch = -1;
    if (receipt.returnValue) {
      try {
        const native = (await import("@stellar/stellar-sdk")).scValToNative(receipt.returnValue);
        epoch = Number(native);
      } catch {
        epoch = -1;
      }
    }
    return { hash: sent.hash, epoch, ledger: receipt.ledger };
  }
  throw new Error(`Timed out waiting for transaction receipt ${sent.hash}`);
}
