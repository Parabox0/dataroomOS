// Short summaries of a file. Claude writes them when a key is set; otherwise the
// app picks the file's own most informative sentences and says so.
import { sentences, tokens, clip } from "./text";
import { hasSensitive } from "./sensitive";

export function localSummary(pageTexts: string[], maxSentences = 3): string {
  const all = pageTexts.flatMap((t, p) => sentences(t).map((s, i) => ({ s, p, i })));
  if (!all.length) return "This file has no readable text, so there is nothing to summarise.";
  const freq = new Map<string, number>();
  for (const { s } of all) for (const t of new Set(tokens(s))) freq.set(t, (freq.get(t) ?? 0) + 1);
  const scored = all
    .filter(({ s }) => s.length >= 40 && s.length <= 260 && /[a-z]/.test(s) && !/fictional company made for/i.test(s) && !hasSensitive(s))
    .map((x) => {
      const toks = tokens(x.s);
      const content = toks.reduce((a, t) => a + Math.log(1 + (freq.get(t) ?? 0)), 0) / Math.sqrt(toks.length + 1);
      const figures = /[\d$%]/.test(x.s) ? 1.3 : 1;
      const early = 1 + 0.4 / (1 + x.p) + 0.2 / (1 + x.i);
      return { ...x, score: content * figures * early };
    })
    .sort((a, b) => b.score - a.score);
  const picked: typeof scored = [];
  for (const c of scored) {
    if (picked.length >= maxSentences) break;
    const ct = new Set(tokens(c.s));
    const overlaps = picked.some((p) => {
      const pt = new Set(tokens(p.s));
      const common = [...ct].filter((t) => pt.has(t)).length;
      return common / Math.max(1, Math.min(ct.size, pt.size)) > 0.6;
    });
    if (!overlaps) picked.push(c);
  }
  picked.sort((a, b) => a.p - b.p || a.i - b.i);
  return picked.map((x) => clip(x.s.replace(/[.:;,]?$/, "."), 260)).join(" ");
}
