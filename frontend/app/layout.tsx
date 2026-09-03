import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { CONTRACT_ID, contractUrl } from "@/lib/stellar";
import { shortHex } from "@/lib/format";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tessera — Private proofs, public trust",
  description:
    "Tessera enables confidential treasury attestations on Stellar. Prove a group is whole, solvent, and fairly distributed — without revealing a single member balance. Real Groth16 proofs generated in your browser, verified on-chain by Soroban.",
  openGraph: {
    title: "Tessera — Private proofs, public trust",
    description:
      "Confidential treasury attestations on Stellar. Zero-knowledge proofs, on-chain verification.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tessera — Private proofs, public trust",
    description:
      "Confidential treasury attestations on Stellar. Zero-knowledge proofs, on-chain verification.",
  },
  robots: "index, follow",
  themeColor: "#5be0c8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${inter.variable}`}>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-icon.svg" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${geist.className} ${inter.className}`}>
        <Nav />
        <main className="mx-auto min-h-[calc(100vh-56px)] max-w-6xl px-6 py-16 lg:px-8">
          {children}
        </main>
        <footer className="border-t border-[var(--color-line)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-[var(--color-faint)] lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <span>
              Circom + Groth16 (BN254) · verified on-chain by Soroban · Stellar
              testnet, Protocol 27
            </span>
            <a
              href={contractUrl()}
              target="_blank"
              rel="noreferrer"
              className="tnum transition-colors hover:text-[var(--color-accent-bright)]"
            >
              contract {shortHex(CONTRACT_ID, 6, 6)} ↗
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}