"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Label, Pill, Stat, Dot } from "@/components/ui";
import {
  Attestation,
  contractUrl,
  epochCount,
  getAttestation,
  liveReserveBalance,
} from "@/lib/stellar";
import { fmtRatio, fmtTimestamp, fmtUnits, shortHex } from "@/lib/format";

type State =
  | { k: "loading" }
  | { k: "empty" }
  | { k: "error"; msg: string }
  | { k: "ok"; att: Attestation; epochs: number; liveBalance: bigint | null };

export default function BoardPage() {
  const [state, setState] = useState<State>({ k: "loading" });

  const load = useCallback(async () => {
    setState({ k: "loading" });
    try {
      const [att, epochs] = await Promise.all([getAttestation(), epochCount()]);
      if (!att) {
        setState({ k: "empty" });
        return;
      }
      // Live on-chain balance of the bound reserve holder, read right now.
      // Non-fatal: the stored bound figure still stands if this read lags.
      let liveBalance: bigint | null = null;
      try {
        liveBalance = await liveReserveBalance();
      } catch (err) {
        console.error("[board] live_reserve_balance read failed", err);
      }
      setState({ k: "ok", att, epochs, liveBalance });
    } catch (err) {
      console.error("[board] load failed", err);
      setState({ k: "error", msg: String((err as Error)?.message ?? err) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Pill tone="muted">Public · read-only</Pill>
        </div>
        <h1 className="text-3xl font-semibold md:text-4xl">Treasury ledger</h1>
        <p className="max-w-2xl text-[var(--color-muted)]">
          The latest attestation stored on-chain. It exists only because the
          Soroban contract verified the Groth16 attestation proof AND read the
          treasury holder&apos;s live token balance, requiring the declared
          treasury to be backed by it. No member commitment is revealed.
        </p>
      </header>

      {state.k === "loading" && <BoardSkeleton />}

      {state.k === "empty" && (
        <Card className="flex flex-col items-start gap-4 py-12">
          <Dot tone="warn" />
          <h2 className="text-xl font-semibold">No attestation yet this deployment</h2>
          <p className="max-w-md text-sm text-[var(--color-muted)]">
            The contract holds no verified attestation. Head to the attestation console
            to build a commitment set and publish the first proof.
          </p>
          <a
            href="/attest"
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black hover:bg-[var(--color-accent-bright)]"
          >
            Open attestation console →
          </a>
        </Card>
      )}

      {state.k === "error" && (
        <Card className="flex flex-col gap-4 border-[var(--color-danger)]/30">
          <div className="flex items-center gap-2 text-[var(--color-danger)]">
            <Dot tone="danger" />
            <span className="font-medium">Could not reach the Stellar RPC</span>
          </div>
          <p className="tnum break-all text-xs text-[var(--color-muted)]">{state.msg}</p>
          <Button tone="ghost" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      )}

      {state.k === "ok" && (
        <BoardOk
          att={state.att}
          epochs={state.epochs}
          liveBalance={state.liveBalance}
          onRefresh={() => void load()}
        />
      )}
    </div>
  );
}

function BoardOk({
  att,
  epochs,
  liveBalance,
  onRefresh,
}: {
  att: Attestation;
  epochs: number;
  liveBalance: bigint | null;
  onRefresh: () => void;
}) {
  const healthy = att.reserves >= att.totalLiabilities;
  const surplus = att.reserves - att.totalLiabilities;
  // The treasury figure is bound to a real balance: reserves <= bound_reserves.
  const backed = att.boundReserves >= att.reserves;
  return (
    <div className="flex flex-col gap-6">
      {/* reserve-binding badge -- the differentiator */}
      <div
        className={`flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
          backed
            ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/[0.06]"
            : "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/[0.06]"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent-bright)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <div className="font-semibold text-[var(--color-accent-bright)]">
              Treasury cryptographically bound to on-chain balance
            </div>
            <div className="text-sm text-[var(--color-muted)]">
              The contract read the holder&apos;s live token balance and required{" "}
              <span className="tnum">treasury ≤ balance</span> before storing this
              attestation. The figure is not prover-declared.
            </div>
          </div>
        </div>
        <Pill tone={backed ? "accent" : "danger"}>
          <Dot tone={backed ? "accent" : "danger"} />
          treasury {backed ? "≤" : ">"} on-chain balance
        </Pill>
      </div>
      {/* verdict banner */}
      <div
        className={`flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between ${
          healthy
            ? "border-[var(--color-healthy)]/30 bg-[var(--color-healthy)]/[0.06]"
            : "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/[0.06]"
        }`}
      >
        <div className="flex items-center gap-4">
          <span
            className={`grid h-12 w-12 place-items-center rounded-full ${
              healthy
                ? "bg-[var(--color-healthy)]/15 text-[var(--color-healthy)]"
                : "bg-[var(--color-danger)]/15 text-[var(--color-danger)]"
            }`}
          >
            {healthy ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <div>
            <div
              className={`text-lg font-semibold ${
                healthy ? "text-[var(--color-healthy)]" : "text-[var(--color-danger)]"
              }`}
            >
              {healthy ? "HEALTHY" : "UNDERFUNDED"}
            </div>
            <div className="text-sm text-[var(--color-muted)]">
              ZK-verified on-chain · epoch{" "}
              <span className="tnum">{att.epoch}</span>
            </div>
          </div>
        </div>
        <Pill tone={healthy ? "healthy" : "danger"}>
          <Dot tone={healthy ? "healthy" : "danger"} />
          treasury {healthy ? "≥" : "<"} commitments
        </Pill>
      </div>

      {/* stat grid */}
      <Card>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total commitments"
            value={fmtUnits(att.totalLiabilities)}
            sub="attested, in token units"
          />
          <Stat
            label="ZK-declared treasury"
            value={fmtUnits(att.reserves)}
            sub="proven ≥ commitments in ZK"
          />
          <Stat
            label="On-chain treasury (bound)"
            value={fmtUnits(att.boundReserves)}
            sub={`live balance at ledger ${att.boundLedger}`}
            tone="accent"
          />
          <Stat
            label="Health ratio"
            value={fmtRatio(att.reserves, att.totalLiabilities)}
            sub={`surplus ${fmtUnits(surplus)}`}
            tone={healthy ? "healthy" : "danger"}
          />
        </div>
      </Card>

      <Card>
        <div className="grid gap-8 sm:grid-cols-2">
          <Stat
            label="Treasury control"
            value={att.controlProven ? "proven" : "not set"}
            sub="treasury holder authorized the attestation"
            tone={att.controlProven ? "healthy" : "danger"}
          />
          <Stat
            label="Member non-omission"
            value={att.nonOmissionInCircuit ? "in circuit" : "not latest"}
            sub={
              att.nonOmissionInCircuit
                ? "public signer keys pinned to self-enrolled members"
                : "Latest may be base, risk, or multi attestation"
            }
            tone={att.nonOmissionInCircuit ? "healthy" : "accent"}
          />
        </div>
      </Card>

      {/* provenance */}
      <Card className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <Label>On-chain provenance</Label>
          <Button tone="ghost" onClick={onRefresh}>
            Refresh
          </Button>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row k="Merkle-sum root">
            <span className="tnum text-sm" title={att.rootHashHex}>
              {shortHex(att.rootHashHex, 10, 8)}
            </span>
          </Row>
          <Row k="Verified at">
            <span className="tnum text-sm">{fmtTimestamp(att.timestamp)}</span>
          </Row>
          <Row k="Treasury holder">
            <a
              href={`https://stellar.expert/explorer/testnet/account/${att.reserveHolder}`}
              target="_blank"
              rel="noreferrer"
              className="tnum text-sm text-[var(--color-accent-bright)] hover:underline"
              title={att.reserveHolder}
            >
              {shortHex(att.reserveHolder, 6, 6)} ↗
            </a>
          </Row>
          <Row k="Reserve token (SAC)">
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${att.reserveToken}`}
              target="_blank"
              rel="noreferrer"
              className="tnum text-sm text-[var(--color-accent-bright)] hover:underline"
              title={att.reserveToken}
            >
              {shortHex(att.reserveToken, 6, 6)} ↗
            </a>
          </Row>
          <Row k="Bound at ledger">
            <span className="tnum text-sm">{att.boundLedger}</span>
          </Row>
          <Row k="Live holder balance (now)">
            <span className="tnum text-sm">
              {liveBalance == null ? "pending" : fmtUnits(liveBalance)}
            </span>
          </Row>
        </dl>
        <div className="hairline pt-4">
          <a
            href={contractUrl()}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--color-accent-bright)] hover:underline"
          >
            Inspect the contract on stellar.expert ↗
          </a>
        </div>
      </Card>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{k}</Label>
      <div className="text-[var(--color-fg)]">{children}</div>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-24 animate-pulse rounded-xl border border-[var(--color-line)] bg-white/[0.02]" />
      <div className="h-40 animate-pulse rounded-xl border border-[var(--color-line)] bg-white/[0.02]" />
    </div>
  );
}