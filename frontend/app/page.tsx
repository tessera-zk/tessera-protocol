"use client";

import Link from "next/link";
import { Pill, Stat } from "@/components/ui";
import { Ticker } from "@/components/Ticker";

const PILLARS = [
  { icon: "🔒", title: "Confidential", desc: "Member balances never leave the browser. The zero-knowledge proof reveals only that the totals are correct." },
  { icon: "✅", title: "Verifiable", desc: "The circuit recomputes the Merkle-sum root and carries the sum to the public total. A bad proof cannot be stored." },
  { icon: "📋", title: "Non-omissible", desc: "Members self-enroll with a cryptographic key. Omitting an enrolled member makes the proof impossible to generate." },
];

const FLOWS = [
  { href: "/attest", kicker: "Issuer", title: "Create an attestation", body: "Build the commitment set in-browser, generate the Groth16 proof, and submit. The contract stores it only if the proof verifies.", cta: "Open attestation console" },
  { href: "/ledger", kicker: "Public", title: "Read the on-chain ledger", body: "Anyone reads the latest attestation. An invalid proof can never be stored, so its presence is the guarantee.", cta: "View the ledger" },
  { href: "/safety", kicker: "Safety", title: "Membership, risk, treasury", body: "Member self-enrollment, in-circuit signed attestation, concentration caps, and treasury aggregation.", cta: "Open safety controls" },
  { href: "/membership", kicker: "Member", title: "Prove you were counted", body: "Build a Merkle-sum inclusion proof against the certified root. Your balance never leaves the tab.", cta: "Verify membership" },
];

function spot(e: React.MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

export default function Home() {
  return (
    <div className="flex flex-col gap-24">
      {/* hero */}
      <section className="relative grid gap-12 pt-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="mesh-bg pointer-events-none absolute inset-0 -z-10" />
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="accent">Stellar testnet · Protocol 27</Pill>
            <Pill tone="muted">Circom + Groth16 · on-chain verify</Pill>
          </div>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.05] md:text-6xl">
            Private proofs, <span className="accent-word">public trust</span>.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
            Tessera enables confidential treasury attestations on Stellar. Prove a group is
            whole, solvent, and fairly distributed — without revealing a single member balance.
            The proof is generated in the browser and verified on-chain by a Soroban contract,
            with treasury bound to a real, controlled balance.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/attest" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-bright)]">
              Create attestation
            </Link>
            <Link href="/ledger" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-line-strong)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-white/[0.04]">
              View the ledger
            </Link>
            <Link href="/developers" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-line-strong)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-white/[0.04]">
              Developer docs
            </Link>
          </div>
        </div>

        {/* live proof panel */}
        <div className="card-elevated spot p-6" onMouseMove={spot}>
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-faint)]">
              Latest attestation
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-healthy)]/30 bg-[var(--color-healthy)]/[0.08] px-2.5 py-1 text-[11px] font-medium text-[var(--color-healthy)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-healthy)]" /> healthy
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-5">
            <Stat label="Commitments" value={<Ticker value={184140} className="text-2xl" />} />
            <Stat label="Treasury" value={<Ticker value={189140} className="text-2xl text-[var(--color-accent-bright)]" />} />
            <Stat label="Health ratio" value={<Ticker value={102.71} decimals={2} suffix="%" className="text-2xl text-[var(--color-healthy)]" />} />
            <Stat label="Contract tests" value={<Ticker value={26} className="text-2xl" suffix=" pass" />} />
          </div>
          <div className="mt-5 border-t border-[var(--color-line)] pt-4 text-xs leading-relaxed text-[var(--color-muted)]">
            Treasury is bound to a live on-chain balance via a cross-contract read
            plus treasury-holder authorization. A stale, unbacked, or forged proof is
            refused.
          </div>
        </div>
      </section>

      {/* pillars */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold">What makes Tessera different</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="card-elevated spot flex flex-col gap-4 p-6" onMouseMove={spot}>
              <span className="text-3xl">{p.icon}</span>
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--color-muted)]">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* flows bento */}
      <section className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">Four views, one proof system</h2>
          <span className="hidden text-sm text-[var(--color-faint)] sm:block">issuer to contract to member</span>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {FLOWS.map((f) => (
            <Link key={f.href} href={f.href} className="group">
              <div className="card-elevated spot flex h-full flex-col gap-4 p-6 transition-all hover:border-[var(--color-line-strong)] hover:-translate-y-[2px]" onMouseMove={spot}>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-accent)]">{f.kicker}</div>
                <h3 className="text-lg font-semibold leading-snug">{f.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-[var(--color-muted)]">{f.body}</p>
                <span className="text-sm text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent-bright)]">{f.cta}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}