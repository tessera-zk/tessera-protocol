import { NextResponse } from "next/server";
import {
  CONTRACT_ID,
  explorerTxUrl,
  getAttestation,
  liveReserveBalance,
} from "@/lib/stellar";
import { loadAttestedBook } from "@/lib/book";

// Public treasury status endpoint. Read-only: simulates get_attestation and the
// live reserve balance, returns a compact JSON badge payload an issuer can embed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ratioPct(reserves: bigint, commitments: bigint): number | null {
  if (commitments <= 0n) return null;
  return Number((reserves * 10000n) / commitments) / 100;
}

export async function GET() {
  try {
    const att = await getAttestation();
    if (!att) {
      return NextResponse.json(
        { ok: true, status: "no-attestation", contract: CONTRACT_ID },
        { headers: { "cache-control": "no-store" } },
      );
    }
    let live: string | null = null;
    try {
      live = (await liveReserveBalance()).toString();
    } catch {
      live = null;
    }
    const healthy = att.reserves >= att.totalLiabilities;
    const book = loadAttestedBook();
    const txHash = book?.rootHashHex === att.rootHashHex ? book?.txHash ?? null : null;

    return NextResponse.json(
      {
        ok: true,
        status: healthy ? "healthy" : "underfunded",
        contract: CONTRACT_ID,
        epoch: att.epoch,
        totalCommitments: att.totalLiabilities.toString(),
        treasury: att.reserves.toString(),
        boundTreasury: att.boundReserves.toString(),
        liveReserveBalance: live,
        ratioPct: ratioPct(att.reserves, att.totalLiabilities),
        rootHash: att.rootHashHex,
        treasuryHolder: att.reserveHolder,
        controlProven: att.controlProven,
        nonOmissionInCircuit: att.nonOmissionInCircuit,
        boundLedger: att.boundLedger,
        timestamp: att.timestamp,
        tx: txHash ? explorerTxUrl(txHash) : null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}