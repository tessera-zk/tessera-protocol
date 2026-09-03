"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/WalletButton";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/issuer", label: "Attest" },
  { href: "/board", label: "Ledger" },
  { href: "/advanced", label: "Safety" },
  { href: "/badge", label: "Developers" },
  { href: "/inclusion", label: "Membership" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[var(--color-bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent-bright)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
              <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
              <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
              <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M7 11l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Tessera
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-white/[0.06] text-[var(--color-fg)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}