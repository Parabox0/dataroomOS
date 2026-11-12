// Ask: answers questions from the files a person can see, with numbered sources.
import "server-only";
import type { DB } from "./db";
import type { Source } from "./db/schema";
import { visibleDocs, pageTexts } from "./room";
import { localAnswer, topPages, type PageText } from "./search";
import { askClaude, aiEnabled } from "./claude";
import { clip, sentences, tokens } from "./text";

export type Reply = { answer: string; sources: Source[]; mode: "claude" | "local"; found: boolean };

export async function answer(db: DB, roomId: string, personId: string | null, query: string): Promise<Reply> {
  const docs = await visibleDocs(db, roomId, personId);
  const pages = await pageTexts(db, docs);
  if (!pages.length) return { answer: "There are no files you can see yet, so there is nothing to answer from.", sources: [], mode: "local", found: false };
  if (aiEnabled()) {
    const r = await claudeAnswer(pages, query);
    if (r) return r;
  }
  return { ...localAnswer(pages, query), mode: "local" };
}

const SYSTEM = `You answer questions about a company's data room. Use only the numbered passages given. Each passage is one page of one file.
Rules:
- Answer in two to four plain sentences. No headings, no lists, no em dashes.
- After every fact, cite the passage it came from like [2]. Only cite passages you used.
- If the passages do not answer the question, reply exactly: NOT_FOUND
- Never guess numbers. Quote figures exactly as written.`;

async function claudeAnswer(pages: PageText[], query: string): Promise<Reply | null> {
  const picked = topPages(pages, query, 8);
  const use = picked.length ? picked : pages.slice(0, 8);
  const body = use.map((p, i) => `[${i + 1}] ${p.title}, page ${p.page}\n${p.text.slice(0, 3500)}`).join("\n\n");
  const text = await askClaude(SYSTEM, `Passages:\n\n${body}\n\nQuestion: ${query}`, 700);
  if (!text) return null;
  if (text.trim().startsWith("NOT_FOUND")) return { answer: "I couldn't find that in the files here.", sources: [], mode: "claude", found: false };
  const cited = [...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))].filter((n) => n >= 1 && n <= use.length);
  const remap = new Map(cited.map((n, i) => [n, i + 1]));
  const sources: Source[] = cited.map((n, i) => {
    const p = use[n - 1];
    return { n: i + 1, documentId: p.documentId, title: p.title, page: p.page, quote: bestQuote(p.text, query, text) };
  });
  const clean = text.replace(/\[(\d+)\]/g, (m, d) => (remap.has(Number(d)) ? `[${remap.get(Number(d))}]` : "")).replace(/\s+—\s+/g, ", ").trim();
  return { answer: clean, sources, mode: "claude", found: true };
}

function bestQuote(pageText: string, query: string, answerText: string) {
  const want = new Set([...tokens(query), ...tokens(answerText)]);
  let best = "";
  let score = -1;
  for (const s of sentences(pageText)) {
    const sc = tokens(s).filter((t) => want.has(t)).length;
    if (sc > score) [best, score] = [s, sc];
  }
  return clip(best, 200);
}

/** A reply the owner can send to a viewer's question, prepared from the files. */
export async function draftReply(db: DB, roomId: string, question: string): Promise<{ draft: string; sources: Source[]; mode: "claude" | "local" }> {
  const docs = await visibleDocs(db, roomId, null);
  const pages = await pageTexts(db, docs);
  if (aiEnabled() && pages.length) {
    const use = topPages(pages, question, 8);
    const body = use.map((p, i) => `[${i + 1}] ${p.title}, page ${p.page}\n${p.text.slice(0, 3500)}`).join("\n\n");
    const text = await askClaude(
      `You draft a short reply from a founder to an investor's question, using only the numbered passages. Write two to four friendly, plain sentences in the first person plural ("we"). Cite facts like [1]. If the files do not answer it, say what you will send and by when is unknown, and suggest the founder adds the missing file. No em dashes.`,
      `Passages:\n\n${body}\n\nInvestor's question: ${question}`,
      600,
    );
    if (text) {
      const cited = [...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))].filter((n) => n >= 1 && n <= use.length);
      const remap = new Map(cited.map((n, i) => [n, i + 1]));
      return {
        draft: text.replace(/\[(\d+)\]/g, (m, d) => (remap.has(Number(d)) ? `[${remap.get(Number(d))}]` : "")).trim(),
        sources: cited.map((n, i) => ({ n: i + 1, documentId: use[n - 1].documentId, title: use[n - 1].title, page: use[n - 1].page, quote: bestQuote(use[n - 1].text, question, text) })),
        mode: "claude",
      };
    }
  }
  const a = localAnswer(pages, question);
  if (!a.found) return { draft: "Thanks for asking. We don't have this in the room yet. We'll add it and let you know.", sources: [], mode: "local" };
  return { draft: `Thanks for asking. Here is what the files say: ${a.answer}`, sources: a.sources, mode: "local" };
}
