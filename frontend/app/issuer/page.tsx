"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Label, LogLine, Pill, Spinner, Dot } from "@/components/ui";
import {
  Account,
  BN254_P,
  buildTree,
  N_LEAVES,
  solvencyInput,
} from "@/lib/merkle";
import { proveSolvency, WitnessError } from "@/lib/prover";
import {
  confirmOnHorizon,
  explorerTxUrl,
  horizonTxUrl,
  submitAttestation,
} from "@/lib/stellar";
import { loadSampleBook, parseCsv, persistAttestedBook } from "@/lib/book";
import { fmtUnits, shortHex } from "@/lib/format";
import { currentWalletAddress } from "@/lib/wallet";
import { submitAttestationWithWallet } from "@/lib/walletSubmit";

type Step = { label: string; state: "pending" | "active" | "done" | "error" };
const TREASURY_HOLDER = "GBKY7FXTESEV6ON5FGMKOIB57OFFAXQT2BMBE2KEHYQPRAT4JQASNUJC";

const STEP_LABELS = [
  "Build commitment tree (Poseidon / BN254)",
  "Generate Groth16 attestation proof in-browser",
  "Encode proof to Soroban byte layout",
  "Submit submit_attestation on testnet",
  "Wait for ledger receipt",
  "Confirm on Horizon",
];

type Outcome =
  | { k: "idle" }
  | { k: "running" }
  | { k: "rejected"; reason: string; kind: string }
  | {
      k: "submitted";
      hash: string;
      epoch: number;
      ledger: number;
      horizon?: { successful: boolean; ledger: number };
      rootHex: string;
    }
  | { k: "error"; msg: string };

export default function IssuerPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [treasury, setTreasury] = useState<string>("189140");
  const [steps, setSteps] = useState<Step[]>(
    STEP_LABELS.map((label) => ({ label, state: "pending" })),
  );
  const [outcome, setOutcome] = useState<Outcome>({ k: "idle" });
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWalletAddress(currentWalletAddress());
    const onWallet = () => setWalletAddress(currentWalletAddress());
    window.addEventListener("por-wallet-changed", onWallet);
    return () => window.removeEventListener("por-wallet-changed", onWallet);
  }, []);

  useEffect(() => {
    loadSampleBook()
      .then(({ accounts, reserves }) => {
        setAccounts(accounts);
        setTreasury(reserves.toString());
      })
      .catch((err) => setOutcome({ k: "error", msg: String(err) }));
  }, []);

  const total = useMemo(
    () => accounts.reduce((s, a) => s + a.balance, 0n),
    [accounts],
  );
  const hasNegative = useMemo(
    () => accounts.some((a) => a.balance < 0n || a.balance >= BN254_P - 1_000_000n),
    [accounts],
  );
  const running = outcome.k === "running";
  const walletCanSign = walletAddress === TREASURY_HOLDER;

  function setStep(i: number, state: Step["state"]) {
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, state } : s)));
  }
  function resetSteps() {
    setSteps(STEP_LABELS.map((label) => ({ label, state: "pending" })));
  }

  function editBalance(index: number, value: string) {
    setAccounts((prev) =>
      prev.map((a) =>
        a.index === index
          ? { ...a, balance: value.trim() === "" || value === "-" ? 0n : BigInt(value) }
          : a,
      ),
    );
  }

  function forgeNegative() {
    // The hidden negative attack: a field-negative commitment that shrinks the total.
    setAccounts((prev) =>
      prev.map((a) => (a.index === 6 ? { ...a, balance: BN254_P - 100n } : a)),
    );
    setOutcome({ k: "idle" });
    resetSteps();
  }

  async function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) throw new Error("No account rows found in CSV.");
      setAccounts(parsed);
      setOutcome({ k: "idle" });
      resetSteps();
    } catch (err) {
      setOutcome({ k: "error", msg: "CSV parse failed: " + String((err as Error)?.message ?? err) });
    }
  }

  async function run() {
    resetSteps();
    setOutcome({ k: "running" });
    try {
      // 1. tree
      setStep(0, "active");
      // Convert any negative UI balance to its field representation for proving.
      const proveAccounts: Account[] = accounts.map((a) => ({
        ...a,
        balance: a.balance < 0n ? BN254_P + a.balance : a.balance,
      }));
      const tree = await buildTree(proveAccounts);
      const input = solvencyInput(tree, BigInt(treasury || "0"));
      setStep(0, "done");

      // 2. prove
      setStep(1, "active");
      let proof;
      try {
        proof = await proveSolvency(input);
      } catch (err) {
        setStep(1, "error");
        if (err instanceof WitnessError) {
          setOutcome({ k: "rejected", reason: err.message, kind: err.kind });
          return;
        }
        throw err;
      }
      setStep(1, "done");

      // 3. encode (already bytes in proof result)
      setStep(2, "active");
      setStep(2, "done");

      // 4. submit (signed server-side by the issuer key held in .env.local)
      setStep(3, "active");
      const rootHex = proof.publicSignals[0]
        ? BigInt(proof.publicSignals[0]).toString(16).padStart(64, "0")
        : "";
      const signer = currentWalletAddress();
      const res = signer === TREASURY_HOLDER
        ? await submitAttestationWithWallet(signer, proof.proofBytes, proof.signalBytes)
        : await submitAttestation(proof.proofBytes, proof.signalBytes);
      setStep(3, "done");

      // 5. receipt already awaited inside submitAttestation
      setStep(4, "done");

      // persist the attested book so the membership view reconstructs this tree
      persistAttestedBook({
        accounts: tree.accounts.map((a) => ({
          index: a.index,
          label: a.label,
          acctId: a.acctId.toString(),
          salt: a.salt.toString(),
          balance: a.balance.toString(),
        })),
        reserves: treasury,
        rootHashHex: rootHex,
        txHash: res.hash,
        epoch: res.epoch,
        at: Date.now(),
      });

      // 6. horizon confirmation
      setStep(5, "active");
      let horizon: { successful: boolean; ledger: number } | undefined;
      try {
        horizon = await confirmOnHorizon(res.hash);
        setStep(5, horizon.successful ? "done" : "error");
      } catch (err) {
        console.error("[issuer] horizon confirm failed", err);
        setStep(5, "error");
      }

      setOutcome({
        k: "submitted",
        hash: res.hash,
        epoch: res.epoch,
        ledger: res.ledger,
        horizon,
        rootHex,
      });
    } catch (err) {
      console.error("[issuer] run failed", err);
      setOutcome({ k: "error", msg: String((err as Error)?.message ?? err) });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div>
          <Pill tone="accent">Attestation console</Pill>
        </div>
        <h1 className="text-3xl font-semibold md:text-4xl">Create a treasury attestation</h1>
        <p className="max-w-2xl text-[var(--color-muted)]">
          The commitments below are private witnesses. They are hashed into a
          Merkle-sum tree and fed to the Groth16 prover in your browser. Only the
          root, total, and treasury leave this tab, wrapped inside a proof.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* left: the book */}
        <Card className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <Label>Commitment set · {accounts.length}/{N_LEAVES} accounts</Label>
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-md border border-[var(--color-line-strong)] px-2.5 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                Load CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onCsv} />
              <button
                onClick={forgeNegative}
                disabled={running}
                className="rounded-md border border-[var(--color-danger)]/40 px-2.5 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
              >
                Forge negative commitment
              </button>
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto rounded-lg border border-[var(--color-line)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--color-surface)] text-[var(--color-faint)]">
                <tr className="text-left text-[11px] uppercase tracking-[0.12em]">
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Acct ID</th>
                  <th className="px-3 py-2 text-right font-medium">Commitment (private)</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const neg = a.balance < 0n || a.balance >= BN254_P - 1_000_000n;
                  return (
                    <tr key={a.index} className="border-t border-[var(--color-line)]">
                      <td className="px-3 py-1.5">{a.label}</td>
                      <td className="tnum px-3 py-1.5 text-[var(--color-muted)]">{a.acctId.toString()}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          value={neg ? "-100" : a.balance.toString()}
                          onChange={(e) => editBalance(a.index, e.target.value)}
                          disabled={running}
                          className={`tnum w-28 rounded border bg-transparent px-2 py-0.5 text-right ${
                            neg
                              ? "border-[var(--color-danger)]/50 text-[var(--color-danger)]"
                              : "border-[var(--color-line)] text-[var(--color-fg)]"
                          } focus:border-[var(--color-accent)] focus:outline-none`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-white/[0.02] px-4 py-3">
            <Label>Total commitments (computed locally)</Label>
            <span className="tnum text-lg text-[var(--color-fg)]">
              {hasNegative ? "forged" : fmtUnits(total)}
            </span>
          </div>
        </Card>

        {/* right: controls */}
        <Card className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Attested treasury (public input)</Label>
            <input
              value={treasury}
              onChange={(e) => setTreasury(e.target.value.replace(/[^0-9]/g, ""))}
              disabled={running}
              className="tnum rounded-lg border border-[var(--color-line-strong)] bg-transparent px-3 py-2 text-lg focus:border-[var(--color-accent)] focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setTreasury((total + 5000n).toString())}
                disabled={running || hasNegative}
                className="rounded-md border border-[var(--color-line-strong)] px-2.5 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-40"
              >
                Healthy (+5,000)
              </button>
              <button
                onClick={() => setTreasury((total - 1n).toString())}
                disabled={running || hasNegative}
                className="rounded-md border border-[var(--color-warn)]/40 px-2.5 py-1 text-xs text-[var(--color-warn)] hover:bg-[var(--color-warn)]/10 disabled:opacity-40"
              >
                Underfunded (−1)
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-line)] bg-white/[0.02] px-3 py-2.5">
            <Label>Signing</Label>
            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
              The proof is generated here in your browser. If the connected
              wallet is the treasury holder, the final
              <span className="text-[var(--color-muted)]"> submit_attestation </span>
              is prepared in this tab and signed by Freighter or another Stellar
              wallet. If no treasury-holder wallet is connected, the app uses the
              labeled server demo signer as a fallback for local demos.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-line)] bg-white/[0.02] p-3 text-xs leading-relaxed text-[var(--color-muted)]">
            <span className="font-medium text-[var(--color-fg)]">Wallet signing mode:</span>{" "}
            Connect the treasury-holder wallet to sign with Freighter or Wallets Kit.
            Treasury holder: <span className="tnum text-[var(--color-accent-bright)]">{shortHex(TREASURY_HOLDER, 6, 6)}</span>. Any other wallet can inspect the proof but cannot authorize the treasury-backed write.
          </div>

          <Button onClick={() => void run()} disabled={running} className="w-full">
            {running ? (
              <>
                <Spinner /> Proving & submitting…
              </>
            ) : (
              walletCanSign ? "Generate proof & submit with wallet" : "Generate proof & submit with server fallback"
            )}
          </Button>

          <div className="hairline pt-4">
            {steps.map((s, i) => (
              <LogLine key={i} state={s.state}>
                {s.label}
              </LogLine>
            ))}
          </div>
        </Card>
      </div>

      {/* outcome */}
      {outcome.k === "rejected" && (
        <Card className="flex flex-col gap-3 border-[var(--color-danger)]/40 bg-[var(--color-danger)]/[0.05]">
          <div className="flex items-center gap-2 text-[var(--color-danger)]">
            <Dot tone="danger" />
            <span className="font-semibold">
              Proof rejected {outcome.kind === "negative-balance" ? "· negative-commitment attack blocked" : outcome.kind === "insolvent" ? "· underfunded book" : ""}
            </span>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
            {outcome.reason}
          </p>
          <p className="text-xs text-[var(--color-faint)]">
            Nothing was submitted on-chain. An unsatisfiable constraint means no
            proof exists, which is exactly the guarantee.
          </p>
        </Card>
      )}

      {outcome.k === "submitted" && (
        <Card className="flex flex-col gap-4 border-[var(--color-healthy)]/30 bg-[var(--color-healthy)]/[0.05]">
          <div className="flex items-center gap-2 text-[var(--color-healthy)]">
            <Dot tone="healthy" />
            <span className="font-semibold">
              Attestation verified on-chain and stored · epoch {outcome.epoch}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label>Transaction hash</Label>
              <a
                href={explorerTxUrl(outcome.hash)}
                target="_blank"
                rel="noreferrer"
                className="tnum break-all text-sm text-[var(--color-accent-bright)] hover:underline"
              >
                {outcome.hash}
              </a>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Merkle-sum root</Label>
              <span className="tnum text-sm" title={outcome.rootHex}>
                {shortHex(outcome.rootHex, 12, 10)}
              </span>
            </div>
          </div>
          <div className="hairline flex flex-wrap items-center gap-4 pt-4 text-sm">
            <span className="text-[var(--color-muted)]">
              Ledger <span className="tnum">{outcome.ledger}</span>
            </span>
            {outcome.horizon && (
              <Pill tone={outcome.horizon.successful ? "healthy" : "danger"}>
                Horizon: {outcome.horizon.successful ? "successful" : "failed"}
              </Pill>
            )}
            <a
              href={horizonTxUrl(outcome.hash)}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent-bright)] hover:underline"
            >
              View on Horizon ↗
            </a>
            <a href="/ledger" className="text-[var(--color-fg)] hover:text-[var(--color-accent-bright)]">
              Open the ledger →
            </a>
          </div>
        </Card>
      )}

      {outcome.k === "error" && (
        <Card className="flex flex-col gap-3 border-[var(--color-danger)]/40">
          <div className="flex items-center gap-2 text-[var(--color-danger)]">
            <Dot tone="danger" />
            <span className="font-semibold">Something went wrong</span>
          </div>
          <p className="tnum break-all text-xs text-[var(--color-muted)]">{outcome.msg}</p>
        </Card>
      )}
    </div>
  );
}