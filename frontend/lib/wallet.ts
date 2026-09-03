"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Networks,
  StellarWalletsKit,
} from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { NETWORK_PASSPHRASE } from "@/lib/stellar";

const STORAGE_KEY = "tessera.wallet.v1";
const EVENT = "tessera-wallet-changed";
let initialized = false;

function ensureKit() {
  if (initialized || typeof window === "undefined") return;
  StellarWalletsKit.init({
    modules: defaultModules(),
    network: Networks.TESTNET,
    authModal: { hideUnsupportedWallets: false, showInstallLabel: true },
  });
  initialized = true;
}

function notify(address: string | null) {
  if (typeof window === "undefined") return;
  if (address) localStorage.setItem(STORAGE_KEY, address);
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { address } }));
}

export async function connectWallet(): Promise<string> {
  ensureKit();
  const { address } = await StellarWalletsKit.authModal();
  notify(address);
  return address;
}

export async function disconnectWallet(): Promise<void> {
  ensureKit();
  await StellarWalletsKit.disconnect().catch(() => undefined);
  notify(null);
}

export function currentWalletAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export async function signWalletTransaction(xdr: string, address: string): Promise<string> {
  ensureKit();
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });
  return signedTxXdr;
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAddress(currentWalletAddress());
    const onChange = (event: Event) => {
      setAddress((event as CustomEvent<{ address: string | null }>).detail?.address ?? currentWalletAddress());
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setAddress(await connectWallet());
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnectWallet();
      setAddress(null);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }, []);

  return { address, busy, error, connect, disconnect };
}