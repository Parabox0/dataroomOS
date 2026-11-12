// Search over the room's pages. Pure functions so they are easy to test.
// Scores single sentences (BM25 style), so a short answer can quote the exact line it came from.
import { queryTerms, sentences, tokens, clip } from "./text";

export type PageText = { documentId: string; title: string; page: number; text: string };
export type Hit = { documentId: string; title: string; page: number; sentence: string; score: number; index: number };

type Unit = { p: PageText; sentence: string; index: number; toks: string[] };

export function searchSentences(pages: PageText[], query: string, limit = 12): Hit[] {
  const terms = queryTerms(query);
  if (!terms.size) return [];
  const units: Unit[] = [];
  for (const p of pages) {
    sentences(p.text).forEach((sentence, index) => units.push({ p, sentence, index, toks: tokens(sentence) }));
  }
  if (!units.length) return [];
  const df = new Map<string, number>();
  for (const u of units) for (const t of new Set(u.toks)) df.set(t, (df.get(t) ?? 0) + 1);
  const avg = units.reduce((a, u) => a + u.toks.length, 0) / units.length;
  const N = units.length;
  const hits: Hit[] = [];
  for (const u of units) {
    const tf = new Map<string, number>();
    for (const t of u.toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    let matched = 0;
    for (const [t, w] of terms) {
      const f = tf.get(t);
      if (!f) continue;
      matched += w;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += w * idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (u.toks.length / avg))));
    }
    if (!score) continue;
    const titleToks = new Set(tokens(u.p.title));
    for (const [t, w] of terms) if (titleToks.has(t)) score += 0.6 * w;
    // Sentences with figures answer most data room questions. Bare headings answer nothing,
    // unless they head a table, which localAnswer then expands.
    const hasFigure = /[\d$%]/.test(u.sentence);
    if (hasFigure) score *= 1.15;
    if (u.toks.length >= 6 && /[.!?]$/.test(u.sentence)) score *= 1.15;
    if (!hasFigure && u.toks.length < 5 && !tableRows(units, u).length) score *= 0.35;
    // Prefer sentences that cover more of the question.
    score *= 0.6 + 0.4 * Math.min(1, matched / Math.max(1, [...terms.values()].filter((w) => w === 1).length));
    hits.push({ documentId: u.p.documentId, title: u.p.title, page: u.p.page, sentence: u.sentence, score, index: u.index });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** If this line heads a table, the rows under it (lines with figures, up to 8). */
function tableRows(units: { p: PageText; index: number; sentence: string }[], u: { p: PageText; index: number; sentence: string }): string[] {
  if (/[.!?]$/.test(u.sentence) || u.sentence.length > 70) return [];
  const rows: string[] = [];
  for (const x of units) {
    if (x.p !== u.p || x.index <= u.index) continue;
    if (x.index > u.index + 9) break;
    if (/[\d$%]/.test(x.sentence) && x.sentence.length < 110 && !/[.!?]$/.test(x.sentence)) rows.push(x.sentence);
    else break;
  }
  return rows.length >= 2 ? rows : [];
}

export type Answer = { answer: string; sources: { n: number; documentId: string; title: string; page: number; quote: string }[]; found: boolean };

/** Built-in answer: quotes the best matching lines and numbers them. */
export function localAnswer(pages: PageText[], query: string): Answer {
  const hits = searchSentences(pages, query, 12);
  if (!hits.length || hits[0].score < 1.2) {
    return { answer: "I couldn't find that in the files here.", sources: [], found: false };
  }
  const sourceFor = (h: Hit, quote: string) => {
    let n = sources.find((x) => x.documentId === h.documentId && x.page === h.page)?.n;
    if (!n) {
      n = sources.length + 1;
      sources.push({ n, documentId: h.documentId, title: h.title, page: h.page, quote: clip(quote, 200) });
    }
    return n;
  };
  const sources: Answer["sources"] = [];
  const top = hits[0];
  const pageOf = (h: Hit) => pages.find((p) => p.documentId === h.documentId && p.page === h.page)!;
  const lines = (h: Hit) => sentences(pageOf(h).text);

  // A table: give the rows.
  const units = lines(top).map((sentence, index) => ({ p: pageOf(top), index, sentence }));
  const rows = tableRows(units, units[top.index] ?? { p: pageOf(top), index: top.index, sentence: top.sentence });
  if (rows.length) {
    const n = sourceFor(top, `${top.sentence}: ${rows[0]}`);
    return { answer: `From ${top.title} [${n}]:\n${rows.join("\n")}`, sources, found: true };
  }

  const picked: Hit[] = [top];
  for (const h of hits.slice(1)) {
    if (picked.length >= 3) break;
    if (h.score < top.score * 0.55) break;
    if (picked.some((p) => p.sentence === h.sentence || (p.documentId === h.documentId && p.page === h.page && Math.abs(p.index - h.index) <= 1))) continue;
    if (h.sentence.length < 12) continue;
    picked.push(h);
  }
  const parts: string[] = [];
  for (const h of picked) {
    let text = h.sentence;
    // "With it, runway is 26 months." needs the sentence before it.
    if (/^(it|this|that|these|those|they|with it|so|which)\b/i.test(text) && h.index > 0) text = `${lines(h)[h.index - 1]} ${text}`;
    const n = sourceFor(h, text);
    parts.push(`${text.replace(/[.:;,]?\s*$/, ".")} [${n}]`);
  }
  return { answer: parts.join(" "), sources, found: true };
}

/** The pages most worth sending to Claude for a question, best first. */
export function topPages(pages: PageText[], query: string, limit = 8): PageText[] {
  const hits = searchSentences(pages, query, 60);
  const score = new Map<string, number>();
  for (const h of hits) {
    const k = `${h.documentId}:${h.page}`;
    score.set(k, (score.get(k) ?? 0) + h.score);
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const byKey = new Map(pages.map((p) => [`${p.documentId}:${p.page}`, p]));
  return ranked.slice(0, limit).map((k) => byKey.get(k)!).filter(Boolean);
}
