"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Dot, Label, Pill, Stat, Button } from "@/components/ui";
import {
  aggregateReserves,
  contractUrl,
  getAttestation,
  getMultiAttestation,
  getRiskAttestation,
  registeredKeyCount,
  registeredKeys,
  reserveLegs,
  signedEpoch,
  type Attestation,
  type CustomerKey,
  type MultiAttestation,
  type ReserveLeg,
  type RiskAttestation,
} from "@/lib/stellar";
import { fmtRatio, fmtTimestamp, fmtUnits, shortHex } from "@/lib/format";
import {
  ADVANCED_TXS,
  AUTHORITATIVE_CONTRACT,
  REJECTIONS,
  RISK_EVIDENCE,
} from "@/lib/advancedEvidence";

type Tab = "enrollment" | "risk" | "treasury";

type AdvancedState = {
  loading: boolean;
  error: string | null;
  latest: Attestation | null;
  signedEpoch: number | null;
  keyCount: number | null;
  keys: CustomerKey[];
  risk: RiskAttestation | null;
  multi: MultiAttestation | null;
  aggregate: bigint | null;
  legs: ReserveLeg[];
};

const initialState: AdvancedState = {
  loading: true,
  error: null,
  latest: null,
  signedEpoch: null,
  keyCount: null,
  keys: [],
  risk: null,
  multi: null,
  aggregate: null,
  legs: [],
};

const TABS: { id: Tab; label: string }[] = [
  { id: "enrollment", label: "Member enrollment" },
  { id: "risk", label: "Safety limits" },
  { id: "treasury", label: "Treasury aggregation" },
];

export default function AdvancedPage() {
  const [tab, setTab] = useState<Tab>("enrollment");
  const [state, setState] = useState<AdvancedState>(initialState);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [latest, epoch, count, keys, risk, multi, aggregate, legs] = await Promise.allSettled([
        getAttestation(),
        signedEpoch(),
        registeredKeyCount(),
        registeredKeys(),
        getRiskAttestation(),
        getMultiAttestation(),
        aggregateReserves(),
        reserveLegs(),
      ]);
      setState({
        loading: false,
        error: null,
        latest: latest.status === "fulfilled" ? latest.value : null,
        signedEpoch: epoch.status === "fulfilled" ? epoch.value : null,
        keyCount: count.status === "fulfilled" ? count.value : null,
        keys: keys.status === "fulfilled" ? keys.value : [],
        risk: risk.status === "fulfilled" ? risk.value : null,
        multi: multi.status === "fulfilled" ? multi.value : null,
        aggregate: aggregate.status === "fulfilled" ? aggregate.value : null,
        legs: legs.status === "fulfilled" ? legs.value : [],
      });
    } catch (err) {
      setState({
        ...initialState,
        loading: false,
        error: String((err as Error)?.message ?? err),
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="accent">Core backend</Pill>
          <Pill tone="muted">Evidence only where writes already landed</Pill>
        </div>
        <h1 className="max-w-3xl text-3xl font-semibold md:text-4xl">
          Safety controls
        </h1>
        <p className="max-w-3xl text-[var(--color-muted)]">
          This page reads the core contract and displays only real on-chain
          transactions or explicit rejection evidence from the testnet scripts.
          There are no mocked proofs, placeholder tx hashes, or public signing
          secrets.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <a
            href={contractUrl()}
            target="_blank"
            rel="noreferrer"
            className="tnum text-[var(--color-accent-bright)] hover:underline"
          >
            contract {shortHex(AUTHORITATIVE_CONTRACT, 8, 8)}
          </a>
          <Button tone="ghost" onClick={() => void load()} disabled={state.loading}>
            Refresh reads
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-[var(--color-line)] pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              tab === t.id
                ? "bg-white/[0.08] text-[var(--color-fg)]"
                : "text-[var(--color-muted)] hover:bg-white/[0.04] hover:text-[var(--color-fg)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {state.error && (
        <Card className="border-[var(--color-danger)]/40">
          <div className="flex items-center gap-2 text-[var(--color-danger)]">
            <Dot tone="danger" />
            <span className="font-medium">Advanced reads failed</span>
          </div>
          <p className="tnum mt-3 break-all text-xs text-[var(--color-muted)]">{state.error}</p>
        </Card>
      )}

      {tab === "enrollment" && <EnrollmentTab state={state} />}
      {tab === "risk" && <RiskTab state={state} />}
      {tab === "treasury" && <TreasuryTab state={state} />}
    </div>
  );
}

function EnrollmentTab({ state }: { state: AdvancedState }) {
  const nonOmissionStored = Boolean(state.latest?.nonOmissionInCircuit);
  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Card className="flex flex-col gap-5">
        <SectionTitle
          title="Member self-enrollment set"
          detail="Each Baby-JubJub key is appended by the member with member.require_auth. The issuer no longer publishes a circular pubkeyHash."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Enrolled members" value={state.keyCount ?? "..."} sub="expected 4 for depth-2 demo" tone="accent" />
          <Stat label="Accepted signed epoch" value={state.signedEpoch ?? "..."} sub="strictly monotonic" />
          <Stat
            label="Stored non-omission"
            value={nonOmissionStored ? "true" : "see tx"}
            sub="Latest may be overwritten by multi"
            tone={nonOmissionStored ? "healthy" : "accent"}
          />
        </div>
        <div className="rounded-lg border border-[var(--color-line)]">
          {state.keys.length === 0 ? (
            <div className="p-4 text-sm text-[var(--color-muted)]">
              Enrolled members are not available from this RPC response yet. The
              four self-enrollment transactions below are the verified source.
            </div>
          ) : (
            state.keys.map((k, i) => (
              <div key={`${k.axHex}-${i}`} className="grid gap-2 border-t border-[var(--color-line)] p-4 first:border-t-0 sm:grid-cols-[80px_1fr]">
                <Label>Slot {i}</Label>
                <div className="tnum min-w-0 text-xs text-[var(--color-muted)]">
                  <div title={k.axHex}>Ax {shortHex(k.axHex, 12, 10)}</div>
                  <div title={k.ayHex}>Ay {shortHex(k.ayHex, 12, 10)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-5">
        <SectionTitle
          title="Verified signed-attestation evidence"
          detail="The honest path is a submitted transaction. The omission path is a preflight trap, so no ledger tx exists by design."
        />
        <EvidenceLink label="Member A self-enrolls" hash={ADVANCED_TXS.registerA} />
        <EvidenceLink label="Member B self-enrolls" hash={ADVANCED_TXS.registerB} />
        <EvidenceLink label="Member C self-enrolls" hash={ADVANCED_TXS.registerC} />
        <EvidenceLink label="Member D self-enrolls" hash={ADVANCED_TXS.registerD} />
        <EvidenceLink label="submit_signed_attestation honest" hash={ADVANCED_TXS.signedHonest} primary />
        <RejectionCard rejection={REJECTIONS.omission} />
        <RejectionCard rejection={REJECTIONS.replay} />
      </Card>
    </div>
  );
}

function RiskTab({ state }: { state: AdvancedState }) {
  const risk = state.risk;
  const maxBps = risk?.maxConcBps ?? RISK_EVIDENCE.maxConcBps;
  const minBps = risk?.minCollBps ?? RISK_EVIDENCE.minCollBps;
  const ratio = risk ? fmtRatio(risk.reserves, risk.totalLiabilities) : "105% floor";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <Card className="flex flex-col gap-5">
        <SectionTitle
          title="Concentration cap plus collateral floor"
          detail="The safety circuit proves the public policy bounds in zero knowledge. Violating books do not produce a witness."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Max concentration" value={`${maxBps / 100}%`} sub="per leaf, honest scope" tone="accent" />
          <Stat label="Min collateralization" value={`${minBps / 100}%`} sub="public safety input" tone="healthy" />
          <Stat label="Attested ratio" value={ratio} sub={risk ? `ledger ${risk.boundLedger}` : "script evidence"} />
        </div>
        {risk ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <InfoRow k="Safety epoch">{risk.epoch}</InfoRow>
            <InfoRow k="Verified at">{fmtTimestamp(risk.timestamp)}</InfoRow>
            <InfoRow k="Commitments">{fmtUnits(risk.totalLiabilities)}</InfoRow>
            <InfoRow k="Treasury">{fmtUnits(risk.reserves)}</InfoRow>
            <InfoRow k="Root">{shortHex(risk.rootHashHex, 10, 8)}</InfoRow>
            <InfoRow k="Bound treasury">{fmtUnits(risk.boundReserves)}</InfoRow>
          </dl>
        ) : (
          <EvidenceNote>
            No latest safety attestation was returned by the live RPC. The UI is
            showing the fixed circuit policy from {RISK_EVIDENCE.script}; no tx
            hash is displayed because the status file does not publish one for
            the latest fixed safety run.
          </EvidenceNote>
        )}
      </Card>

      <Card className="flex flex-col gap-5">
        <SectionTitle
          title="Unprovable negative cases"
          detail="These are not failed ledger transactions. They fail before submission because no valid witness exists."
        />
        <RejectionCard rejection={REJECTIONS.riskWhale} />
        <RejectionCard rejection={REJECTIONS.undercollateralized} />
        <EvidenceNote>{RISK_EVIDENCE.scope}</EvidenceNote>
      </Card>
    </div>
  );
}

function TreasuryTab({ state }: { state: AdvancedState }) {
  const multi = state.multi;
  const aggregate = state.aggregate ?? multi?.aggregateReserves ?? null;
  const sameUnit = state.legs.every((l) => l.scaleNum === l.scaleDen);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <Card className="flex flex-col gap-5">
        <SectionTitle
          title="Multi-holder, same-unit treasury"
          detail="The core contract rejects issuer-set prices. Treasury legs contribute live balances only when scale is 1:1."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Treasury legs" value={multi?.legCount ?? (state.legs.length || "...")} sub="configured on-chain" />
          <Stat
            label="Live aggregate"
            value={aggregate == null ? "..." : fmtUnits(aggregate)}
            sub="sum of same-unit balances"
            tone="accent"
          />
          <Stat
            label="Scale policy"
            value={sameUnit ? "1:1" : "rejected"}
            sub="non-unit scales trap as Error #13"
            tone={sameUnit ? "healthy" : "danger"}
          />
        </div>
        <div className="rounded-lg border border-[var(--color-line)]">
          {state.legs.length === 0 ? (
            <div className="p-4 text-sm text-[var(--color-muted)]">
              Treasury legs were not returned by the live read. The set-legs and
              multi-attestation transactions below are the verified evidence.
            </div>
          ) : (
            state.legs.map((leg, i) => (
              <div key={`${leg.holder}-${i}`} className="grid gap-3 border-t border-[var(--color-line)] p-4 first:border-t-0">
                <Label>Leg {i + 1}</Label>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <span className="tnum text-[var(--color-muted)]" title={leg.holder}>
                    holder {shortHex(leg.holder, 6, 6)}
                  </span>
                  <span className="tnum text-[var(--color-muted)]" title={leg.token}>
                    token {shortHex(leg.token, 6, 6)}
                  </span>
                  <span className="tnum text-[var(--color-muted)]">
                    scale {leg.scaleNum.toString()}:{leg.scaleDen.toString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-5">
        <SectionTitle
          title="Verified treasury aggregation evidence"
          detail="The accepted path landed on testnet. Non-1:1 scale was rejected during Soroban simulation."
        />
        <EvidenceLink label="set_reserve_legs with 1:1 leg" hash={ADVANCED_TXS.setReserveLegs} />
        <EvidenceLink label="submit_multi_attestation accepted" hash={ADVANCED_TXS.multiHonest} primary />
        <RejectionCard rejection={REJECTIONS.badScale} />
        {multi && (
          <EvidenceNote>
            Stored multi attestation aggregate is {fmtUnits(multi.aggregateReserves)}
            at ledger {multi.boundLedger}. This also refreshes Latest so inclusion
            checks bind to the current certified root.
          </EvidenceNote>
        )}
      </Card>
    </div>
  );
}

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">{detail}</p>
    </div>
  );
}

function EvidenceLink({
  label,
  hash,
  primary = false,
}: {
  label: string;
  hash: string;
  primary?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${primary ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/[0.05]" : "border-[var(--color-line)]"}`}>
      <div className="mb-2 flex items-center gap-2">
        <Dot tone={primary ? "accent" : "healthy"} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <a
        href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
        target="_blank"
        rel="noreferrer"
        className="tnum break-all text-xs text-[var(--color-accent-bright)] hover:underline"
      >
        {hash}
      </a>
    </div>
  );
}

function RejectionCard({
  rejection,
}: {
  rejection: { code: string; label: string; reason: string };
}) {
  return (
    <div className="rounded-lg border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/[0.05] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Dot tone="warn" />
        <span className="text-sm font-medium">{rejection.label}</span>
        <Pill tone="warn">{rejection.code}</Pill>
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">{rejection.reason}</p>
    </div>
  );
}

function EvidenceNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-white/[0.02] p-4 text-sm leading-relaxed text-[var(--color-muted)]">
      {children}
    </div>
  );
}

function InfoRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{k}</Label>
      <div className="tnum text-sm text-[var(--color-muted)]">{children}</div>
    </div>
  );
}