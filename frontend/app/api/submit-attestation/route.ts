import { NextResponse } from "next/server";
import { submitAttestation } from "@/lib/server/stellar";

// Signing needs Node crypto + the @stellar/stellar-sdk, so pin the nodejs
// runtime. The issuer secret is read from server env inside submitAttestation;
// it never reaches this handler's response or the client.
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { proofHex?: string; signalsHex?: string[] };
    const proofHex = body?.proofHex;
    const signalsHex = body?.signalsHex;
    if (typeof proofHex !== "string" || !Array.isArray(signalsHex) || signalsHex.length === 0) {
      return NextResponse.json({ error: "missing proofHex or signalsHex" }, { status: 400 });
    }
    if (!/^(0x)?[0-9a-fA-F]+$/.test(proofHex) || !signalsHex.every((s) => /^(0x)?[0-9a-fA-F]+$/.test(s))) {
      return NextResponse.json({ error: "proofHex/signalsHex must be hex" }, { status: 400 });
    }
    const res = await submitAttestation(proofHex, signalsHex);
    return NextResponse.json({ ok: true, hash: res.hash, epoch: res.epoch, ledger: res.ledger });
  } catch (err) {
    // Never log the secret; err messages here are RPC/preflight failures only.
    console.error("[submit-attestation] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
