import Link from "next/link";
import type { Source } from "@/lib/db/schema";

/** An answer with its numbered sources. Every number opens the page it came from. */
export function AnswerView({ text, sources, hrefFor, mode }: { text: string; sources: Source[]; hrefFor: (s: Source) => string; mode: string }) {
  const byN = new Map(sources.map((s) => [s.n, s]));
  const parts = text.split(/(\[\d+\])/g);
  return (
    <div className="stack">
      <p style={{ fontSize: 16, whiteSpace: "pre-line" }}>
        {parts.map((p, i) => {
          const m = p.match(/^\[(\d+)\]$/);
          const src = m && byN.get(Number(m[1]));
          if (src) return <Link key={i} className="src" href={hrefFor(src)} aria-label={`Source ${src.n}: ${src.title}, page ${src.page}`}>{src.n}</Link>;
          return <span key={i}>{p}</span>;
        })}
      </p>
      {sources.length > 0 && (
        <ol className="list" style={{ marginTop: 14 }} aria-label="Sources">
          {sources.map((s) => (
            <li key={s.n} style={{ padding: "10px 0", alignItems: "flex-start" }}>
              <span className="src" aria-hidden>{s.n}</span>
              <div className="grow">
                <Link href={hrefFor(s)} className="title">{s.title}, page {s.page}</Link>
                <p className="meta">“{s.quote}”</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {sources.length > 0 && <p className="meta">{mode === "claude" ? "Written by Claude from these pages only." : mode === "draft" ? "Drafted from these pages. Read it before you send." : "Built-in answer: the closest lines from the files, quoted as written. Add an OpenRouter or Anthropic key to get written answers."}</p>}
    </div>
  );
}
