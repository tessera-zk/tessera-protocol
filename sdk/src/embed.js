// embed.js — badge helpers (issue #42). Mirrors frontend/lib/badge.ts so
// integrators need only this package. No secrets, read-only URLs.
export const BADGE_API_VERSION = 1;

export function badgeSvgUrl(origin, label = "Tessera") {
  return `${origin.replace(/\/$/, "")}/api/badge/svg?label=${encodeURIComponent(label)}`;
}

export function badgeEmbedHtml(origin, label = "Tessera") {
  const svg = badgeSvgUrl(origin, label);
  const board = `${origin.replace(/\/$/, "")}/badge`;
  return `<a href="${board}" target="_blank" rel="noreferrer"><img src="${svg}" alt="${label} treasury health" width="220" height="28" /></a>`;
}
