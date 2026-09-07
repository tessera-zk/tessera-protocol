import { Card, Dot, Mono } from "./ui";
import { errorAdvice, type TesseraErrorCode } from "@/lib/errors";

// Shared honest-error banner (issue #41): every prover/contract failure maps
// to a typed code + user-readable advice. Raw constraint dumps never reach
// end users; the code stays visible for support/debugging.
export function ErrorBanner({ code, detail }: { code: TesseraErrorCode; detail?: string }) {
  return (
    <Card className="flex flex-col gap-3 border-[var(--color-danger)]/40">
      <div className="flex items-center gap-2 text-[var(--color-danger)]">
        <Dot tone="danger" />
        <span className="font-semibold">Not provable — <Mono>{code}</Mono></span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-fg)]">{errorAdvice(code)}</p>
      {detail ? (
        <p className="tnum break-all text-xs text-[var(--color-muted)]">{detail}</p>
      ) : null}
    </Card>
  );
}
