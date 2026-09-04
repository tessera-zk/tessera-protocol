import { NextResponse } from "next/server";
import { getAttestation } from "@/lib/stellar";

// GET /api/badge/svg — embeddable SVG health badge (NOT-YET #2, issue #6).
// Read-only, no secrets. Returns a small SVG an issuer can <img> anywhere.
// Query: ?label=Tessera (optional). Cache: no-store (always live).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const label = (url.searchParams.get("label") || "Tessera").slice(0, 24);
  let healthy = false;
  let ratio: string | null = null;
  try {
    const att = await getAttestation();
    if (att) {
      healthy = att.reserves >= att.totalLiabilities;
      if (att.totalLiabilities > 0n) {
        const pct = Number((att.reserves * 10000n) / att.totalLiabilities) / 100;
        ratio = `${pct.toFixed(2)}%`;
      }
    }
  } catch {
    healthy = false;
  }
  const status = healthy ? `healthy${ratio ? ` ${ratio}` : ""}` : "pending";
  const color = healthy ? "#16a34a" : "#b45309";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="28" role="img" aria-label="${esc(label)}: ${esc(status)}">` +
    `<rect width="220" height="28" rx="6" fill="#0b0e14"/>` +
    `<rect x="1" y="1" width="218" height="26" rx="5" fill="none" stroke="${color}" stroke-opacity="0.5"/>` +
    `<circle cx="15" cy="14" r="5" fill="${color}"/>` +
    `<text x="27" y="18" font-family="system-ui,sans-serif" font-size="12" fill="#e5e7eb">${esc(label)}</text>` +
    `<text x="210" y="18" font-family="system-ui,sans-serif" font-size="12" text-anchor="end" fill="${color}">${esc(status)}</text>` +
    `</svg>`;
  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "no-store",
      "x-tessera-badge": healthy ? "healthy" : "pending",
      "x-tessera-api-version": "1",
    },
  });
}
