"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Label, LogLine, Pill, Spinner, Dot } from "@/components/ui";
import { Account, buildTree, BuiltTree, inclusionInput } from "@/lib/merkle";
import { proveInclusion, WitnessError } from "@/lib/prover";
import { verifyInclusion } from "@/lib/stellar";
import { loadAttestedBook, loadSampleBook, persistedToAccounts } from "@/lib/book";
import { shortHex } from "@/lib/format";

type Step = { label: string; state: "pending" | "active" | "done" | "error" };
const STEP_LABELS = [
  "Build membership proof in-browser (private commitment)",
  "Encode proof to Soroban bytes",
  "Call verify_inclusion against the on-chain root",
];

type Result =
  | { k: "idle" }
  | { k: "running" }
  | { k: "true" }
  | { k: "false" }
  | { k: "wrong" }
  | { k: "error"; msg: string };

export default function InclusionPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [source, setSource] = useState<"attested" | "sample">("sample");
  const [tree, setTree] = useState<BuiltTree | null>(null);
  const [idx, setIdx] = useState(5);
  const [commitment, setCommitment] = useState("");
  const [steps, setSteps] = useState<Step[]>(
    STEP_LABELS.map((label) => ({ label, state: "pending" })),
  );
  const [result, setResult] = useState<Result>({ k: "idle" });

  useEffect(() => {
    const persisted = loadAttestedBook();
    if (persisted) {
      setAccounts(persistedToAccounts(persisted));
      setSource("attested");
    } else {
      loadSampleBook()
        .then(({ accounts }) => setAccounts(accounts))
        .catch((err) => setResult({ k: "error", msg: String(err) }));
    }
  }, []);

  // Rebuild the Poseidon tree whenever the book changes.
  useEffect(() => {
    if (accounts.length === 0) return;
    let cancelled = false;
    buildTree(accounts)
      .then((t) => {
        if (!cancelled) setTree(t);
      })
      .catch((err) => setResult({ k: "error", msg: String(err) }));
    return () => {
      cancelled = true;
    };
  }, [accounts]);

  const selected = useMemo(() => accounts.find((a) => a.index === idx), [accounts, idx]);
  const leafCommit = tree?.leafCommit[idx];
  const running = result.k === "running";

  function setStep(i: number, state: Step["state"]) {
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, state } : s)));
  }

  async function run() {
    if (!tree) return;
    setSteps(STEP_LABELS.map((label) => ({ label, state: "pending" })));
    setResult({ k: "running" });
    try {
      if (commitment.trim() === "") {
        setResult({ k: "error", msg: "Enter the commitment you believe was counted for your account." });
        return;
      }
      setStep(0, "active");
      const input = inclusionInput(tree, idx, BigInt(commitment));
      let proof;
      try {
        proof = await proveInclusion(input);
      } catch (err) {
        setStep(0, "error");
        if (err instanceof WitnessError) {
          setResult({ k: "wrong" });
          return;
        }
        throw err;
      }
      setStep(0, "done");

      setStep(1, "active");
      setStep(1, "done");

      setStep(2, "active");
      const ok = await verifyInclusion(proof.proofBytes, proof.signalBytes);
      setStep(2, ok ? "done" : "error");
      setResult({ k: ok ? "true" : "false" });
    } catch (err) {
      console.error("[inclusion] run failed", err);
      setResult({ k: "error", msg: String((err as Error)?.message ?? err) });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div>
          <Pill tone="muted">Member</Pill>
        </div>
        <h1 className="text-3xl font-semibold md:text-4xl">Prove your membership</h1>
        <p className="max-w-2xl text-[var(--color-muted)]">
          Pick your account and enter your commitment. The browser builds a
          Merkle-sum membership proof and asks the contract to check it against the
          certified-healthy root. Your commitment never leaves this tab; only the
          proof does.
        </p>
        <div>
          <Pill tone={source === "attested" ? "accent" : "muted"}>
            {source === "attested"
              ? "Using the set you just attested from this browser"
              : "Using the canonical demo set (matches the on-chain root)"}
          </Pill>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Your account</Label>
            <select
              value={idx}
              onChange={(e) => {
                setIdx(Number(e.target.value));
                setResult({ k: "idle" });
              }}
              disabled={running}
              className="rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            >
              {accounts.map((a) => (
                <option key={a.index} value={a.index}>
                  #{a.index} · {a.label} · acct {a.acctId.toString()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Your commitment (secret witness)</Label>
            <input
              value={commitment}
              onChange={(e) => setCommitment(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="known only to you"
              disabled={running}
              className="tnum rounded-lg border border-[var(--color-line-strong)] bg-transparent px-3 py-2 text-lg focus:border-[var(--color-accent)] focus:outline-none"
            />
            <p className="text-xs leading-relaxed text-[var(--color-faint)]">
              Enter the true commitment to get a valid proof. A wrong number cannot
              fold to the attested root, so no proof can be produced.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Published leaf commitment</Label>
            <span className="tnum text-sm text-[var(--color-muted)]" title={leafCommit?.toString()}>
              {leafCommit ? shortHex(leafCommit.toString(16).padStart(64, "0"), 10, 8) : "…"}
            </span>
          </div>

          <Button onClick={() => void run()} disabled={running || !tree} className="w-full">
            {running ? (
              <>
                <Spinner /> Proving…
              </>
            ) : (
              "Prove & verify membership"
            )}
          </Button>
        </Card>

        <Card className="flex flex-col gap-5">
          <Label>Proof pipeline</Label>
          <div>
            {steps.map((s, i) => (
              <LogLine key={i} state={s.state}>
                {s.label}
              </LogLine>
            ))}
          </div>

          <div className="hairline pt-5">
            {result.k === "idle" && (
              <p className="text-sm text-[var(--color-faint)]">
                No proof run yet. Select {selected ? `“${selected.label}”` : "your account"} and
                enter a commitment to check membership in the certified root.
              </p>
            )}

            {result.k === "true" && (
              <ResultBanner tone="healthy" title="Included · verify_inclusion returned true">
                Your commitment is provably inside the Merkle-sum root the contract
                certified healthy. Verified on-chain, and nobody learned the number.
              </ResultBanner>
            )}

            {result.k === "false" && (
              <ResultBanner tone="danger" title="verify_inclusion returned false">
                The proof references a root that is not the currently stored
                attestation. Re-attest the set you are proving against, then retry.
              </ResultBanner>
            )}

            {result.k === "wrong" && (
              <ResultBanner tone="warn" title="No valid proof for that commitment">
                The commitment you entered does not match the committed leaf, so it
                cannot fold to the attested root. This is the zero-knowledge
                guarantee working: you can only prove your true commitment.
              </ResultBanner>
            )}

            {result.k === "error" && (
              <ResultBanner tone="danger" title="Something went wrong">
                <span className="tnum break-all text-xs">{result.msg}</span>
              </ResultBanner>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ResultBanner({
  tone,
  title,
  children,
}: {
  tone: "healthy" | "danger" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const color =
    tone === "healthy"
      ? "text-[var(--color-healthy)]"
      : tone === "warn"
        ? "text-[var(--color-warn)]"
        : "text-[var(--color-danger)]";
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex items-center gap-2 font-semibold ${color}`}>
        <Dot tone={tone} />
        {title}
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">{children}</p>
    </div>
  );
}