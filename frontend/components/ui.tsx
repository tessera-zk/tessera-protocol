"use client";

import { ReactNode } from "react";

type Tone = "accent" | "accent2" | "ghost" | "danger";

export function Button({
  children,
  onClick,
  disabled,
  tone = "accent",
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: Tone;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0";
  const tones: Record<Tone, string> = {
    accent: "bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent-bright)] shadow-[0_0_0_1px_rgba(91,224,200,0.3),0_8px_24px_-12px_rgba(91,224,200,0.7)]",
    accent2: "bg-[var(--color-accent2)] text-white hover:bg-[var(--color-accent2-bright)] shadow-[0_0_0_1px_rgba(124,140,253,0.3),0_8px_24px_-12px_rgba(124,140,253,0.7)]",
    ghost:
      "bg-transparent text-[var(--color-fg)] border border-[var(--color-line-strong)] hover:bg-white/[0.04]",
    danger:
      "bg-transparent text-[var(--color-danger)] border border-[var(--color-danger)]/40 hover:bg-[var(--color-danger)]/10",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  elevated = false,
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return <div className={`${elevated ? "card-elevated" : "card"} p-6 ${className}`}>{children}</div>;
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-faint)]">
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "healthy" | "danger" | "accent" | "accent2";
}) {
  const color =
    tone === "healthy"
      ? "text-[var(--color-healthy)]"
      : tone === "danger"
        ? "text-[var(--color-danger)]"
        : tone === "accent"
          ? "text-[var(--color-accent-bright)]"
          : tone === "accent2"
            ? "text-[var(--color-accent2-bright)]"
            : "text-[var(--color-fg)]";
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className={`tnum text-2xl ${color}`}>{value}</div>
      {sub && <div className="text-xs text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "healthy" | "danger" | "accent" | "accent2" | "warn";
}) {
  const map = {
    muted: "text-[var(--color-muted)] border-[var(--color-line-strong)] bg-white/[0.02]",
    healthy: "text-[var(--color-healthy)] border-[var(--color-healthy)]/30 bg-[var(--color-healthy)]/[0.08]",
    danger: "text-[var(--color-danger)] border-[var(--color-danger)]/30 bg-[var(--color-danger)]/[0.08]",
    accent: "text-[var(--color-accent-bright)] border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.08]",
    accent2: "text-[var(--color-accent2-bright)] border-[var(--color-accent2)]/30 bg-[var(--color-accent2)]/[0.08]",
    warn: "text-[var(--color-warn)] border-[var(--color-warn)]/30 bg-[var(--color-warn)]/[0.08]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: "healthy" | "danger" | "warn" | "accent" | "accent2" | "muted" }) {
  const map = {
    healthy: "bg-[var(--color-healthy)]",
    danger: "bg-[var(--color-danger)]",
    warn: "bg-[var(--color-warn)]",
    accent: "bg-[var(--color-accent)]",
    accent2: "bg-[var(--color-accent2)]",
    muted: "bg-[var(--color-faint)]",
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${map[tone]}`} />;
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`tnum ${className}`}>{children}</span>;
}

export function LogLine({
  state,
  children,
}: {
  state: "pending" | "active" | "done" | "error";
  children: ReactNode;
}) {
  const map = {
    pending: { dot: "muted" as const, text: "text-[var(--color-faint)]" },
    active: { dot: "accent" as const, text: "text-[var(--color-fg)]" },
    done: { dot: "healthy" as const, text: "text-[var(--color-muted)]" },
    error: { dot: "danger" as const, text: "text-[var(--color-danger)]" },
  };
  const s = map[state];
  return (
    <div className={`flex items-center gap-3 py-1.5 text-sm ${s.text}`}>
      {state === "active" ? (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
      ) : (
        <Dot tone={s.dot} />
      )}
      <span>{children}</span>
    </div>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-[var(--color-accent)]" />
  );
}