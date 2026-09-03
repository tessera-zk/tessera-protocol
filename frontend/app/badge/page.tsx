import { CONTRACT_ID, contractUrl, getAttestation, liveReserveBalance } from "@/lib/stellar";
import { fmtRatio, fmtTimestamp, fmtUnits, shortHex } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BadgePage() {
  const att = await getAttestation();
  let live: bigint | null = null;
  try { live = await liveReserveBalance(); } catch { live = null; }
  const healthy = Boolean(att && att.reserves >= att.totalLiabilities);
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center gap-6 py-16">
      <section className={`rounded-2xl border p-6 ${healthy ? "border-[var(--color-healthy)]/35 bg-[var(--color-healthy)]/[0.06]" : "border-[var(--color-warn)]/35 bg-[var(--color-warn)]/[0.06]"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-[var(--color-muted)]">Tessera health badge</div>
            <h1 className="mt-2 text-3xl font-semibold">{healthy ? "Healthy on Stellar" : "No current healthy badge"}</h1>
          </div>
          <div className={`rounded-full px-3 py-1 text-sm font-medium ${healthy ? "bg-[var(--color-healthy)]/15 text-[var(--color-healthy)]" : "bg-[var(--color-warn)]/15 text-[var(--color-warn)]"}`}>
            {healthy ? "verified" : "pending"}
          </div>
        </div>
        {att ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Stat label="Commitments" value={fmtUnits(att.totalLiabilities)} />
            <Stat label="Treasury" value={fmtUnits(att.reserves)} />
            <Stat label="Health ratio" value={fmtRatio(att.reserves, att.totalLiabilities)} />
            <Stat label="Live reserve balance" value={live == null ? "unavailable" : fmtUnits(live)} />
            <Stat label="Epoch" value={String(att.epoch)} />
            <Stat label="Verified at" value={fmtTimestamp(att.timestamp)} />
          </div>
        ) : (
          <p className="mt-6 text-sm leading-relaxed text-[var(--color-muted)]">
            No attestation stored yet. Publish one from the attestation console.
          </p>
        )}
        <div className="mt-6 border-t border-[var(--color-line)] pt-4 text-xs leading-relaxed text-[var(--color-muted)]">
          Embed endpoint: <span className="tnum text-[var(--color-fg)]">/api/solvency</span>. Contract: <a className="tnum text-[var(--color-accent-bright)]" href={contractUrl()} target="_blank" rel="noreferrer">{shortHex(CONTRACT_ID, 8, 6)}</a>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white/[0.02] p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">{label}</div>
      <div className="tnum mt-1 text-lg text-[var(--color-fg)]">{value}</div>
    </div>
  );
}