"use client";

import { useEffect, useRef, useState } from "react";

// No-dependency count-up ticker (adapted from the magicui number-ticker pattern,
// reimplemented with requestAnimationFrame so we add no motion library).
export function Ticker({
  value,
  decimals = 0,
  durationMs = 1200,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  decimals?: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !started.current) {
        started.current = true;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
          setDisplay(value);
          return;
        }
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / durationMs);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(value * eased);
          if (p < 1) requestAnimationFrame(tick);
          else setDisplay(value);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, durationMs]);

  const text = display.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span ref={ref} className={`tnum ${className}`}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
