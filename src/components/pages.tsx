"use client";
import { useEffect, useRef } from "react";

type P = { n: number; w: number; h: number; outlines?: { x: number; y: number; w: number; h: number }[] };

/**
 * Shows a file's pages. For viewers it also measures active reading time per page:
 * the page must be mostly on screen, the tab visible, and the reader active in the last 30 seconds.
 */
export function Pages({ docId, pages, slug, ownerPreview }: { docId: string; pages: P[]; slug?: string; ownerPreview?: boolean }) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (!slug) return;
    const ratio = new Map<number, number>();
    const pending = new Map<number, number>();
    let lastActive = Date.now();
    const active = () => (lastActive = Date.now());
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => ratio.set(Number((e.target as HTMLElement).dataset.n), e.intersectionRatio)),
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    refs.current.forEach((el) => el && io.observe(el));
    const tick = setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - lastActive > 30_000) return;
      let best = 0;
      let bestR = 0.35;
      for (const [n, r] of ratio) if (r > bestR) [best, bestR] = [n, r];
      if (best) pending.set(best, (pending.get(best) ?? 0) + 1);
    }, 1000);
    const flush = (beacon = false) => {
      for (const [page, seconds] of pending) {
        if (seconds < 1) continue;
        const body = JSON.stringify({ slug, documentId: docId, page, seconds: Math.min(seconds, 120) });
        if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        else fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
      }
      pending.clear();
    };
    const every = setInterval(() => flush(), 5000);
    const hide = () => flush(true);
    const evs = ["mousemove", "scroll", "keydown", "touchstart", "wheel"] as const;
    evs.forEach((e) => window.addEventListener(e, active, { passive: true }));
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", hide);
    return () => {
      flush(true);
      io.disconnect();
      clearInterval(tick);
      clearInterval(every);
      evs.forEach((e) => window.removeEventListener(e, active));
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [docId, slug]);

  const q = slug ? `?p=${slug}` : ownerPreview ? "?as=viewer" : "";
  return (
    <div className="pages">
      {pages.map((p, i) => (
        <div key={p.n} id={`p${p.n}`} data-n={p.n} ref={(el) => { refs.current[i] = el; }} className="pagewrap" style={{ scrollMarginTop: 72 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/pages/${docId}/${p.n}${q}`} width={p.w} height={p.h} alt={`Page ${p.n}`} loading={p.n <= 2 ? "eager" : "lazy"} draggable={false} onContextMenu={slug ? (e) => e.preventDefault() : undefined} />
          {p.outlines?.map((b, j) => (
            <span key={j} className="hide-outline" style={{ left: `${(b.x / p.w) * 100}%`, top: `${(b.y / p.h) * 100}%`, width: `${(b.w / p.w) * 100}%`, height: `${(b.h / p.h) * 100}%` }} />
          ))}
          <span className="no">{p.n} of {pages.length}</span>
        </div>
      ))}
    </div>
  );
}
