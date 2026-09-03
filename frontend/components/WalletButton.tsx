"use client";

import { shortHex } from "@/lib/format";
import { useWallet } from "@/lib/wallet";

export function WalletButton() {
  const { address, busy, error, connect, disconnect } = useWallet();

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void disconnect()}
          disabled={busy}
          className="tnum min-h-10 rounded-lg border border-[var(--color-line-strong)] bg-white/[0.02] px-3 py-2 text-xs text-[var(--color-gold-bright)] transition-colors hover:bg-white/[0.04] disabled:opacity-40"
          title={address}
        >
          {shortHex(address, 5, 4)}
        </button>
        {error && <span className="max-w-40 truncate text-xs text-[var(--color-danger)]">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void connect()}
        disabled={busy}
        className="min-h-10 rounded-lg border border-[var(--color-line-strong)] bg-white/[0.02] px-3 py-2 text-xs text-[var(--color-fg)] transition-colors hover:bg-white/[0.04] disabled:opacity-40"
      >
        {busy ? "Connecting..." : "Connect wallet"}
      </button>
      {error && <span className="max-w-40 truncate text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
