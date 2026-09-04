// badgeCache.ts — cache/header policy for public badge endpoints (issue #6).
// Badges must always be live (no-store); issuers cache the SVG themselves if needed.

export const BADGE_CACHE_CONTROL = "no-store" as const;
export const BADGE_API_VERSION_HEADER = "x-tessera-api-version" as const;

export function badgeHeaders(healthy: boolean): Record<string, string> {
  return {
    "cache-control": BADGE_CACHE_CONTROL,
    "x-tessera-badge": healthy ? "healthy" : "pending",
    "x-tessera-api-version": "1",
  };
}
