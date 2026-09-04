// badge.ts — frontend helper for the embeddable health badge (issue #6).
// No secrets, read-only. Works against /api/solvency (JSON) + /api/badge/svg.

export const BADGE_API_VERSION = 1;

export type BadgeStatus = "healthy" | "underfunded" | "no-attestation" | "unknown";

export function badgeSvgUrl(origin: string, label = "Tessera"): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/api/badge/svg?label=${encodeURIComponent(label)}`;
}

export function badgeEmbedHtml(origin: string, label = "Tessera"): string {
  const svg = badgeSvgUrl(origin, label);
  const board = `${origin.replace(/\/$/, "")}/badge`;
  return `<a href="${board}" target="_blank" rel="noreferrer"><img src="${svg}" alt="${label} treasury health" width="220" height="28" /></a>`;
}

export function classifyBadge(json: {
  status?: string;
  treasury?: string;
  totalCommitments?: string;
}): BadgeStatus {
  if (json.status === "healthy") return "healthy";
  if (json.status === "underfunded") return "underfunded";
  if (json.status === "no-attestation") return "no-attestation";
  return "unknown";
}
