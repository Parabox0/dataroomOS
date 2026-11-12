// Adding a file: read the PDF, save page images, find personal details, summarise,
// and tick off any checklist item the file answers.
import "server-only";
import { and, eq } from "drizzle-orm";
import type { DB } from "./db";
import { schema } from "./db";
import { processPdf, fontMeasure } from "./pdf";
import { putFile, deleteFolder } from "./storage";
import { findSensitive } from "./sensitive";
import { localSummary } from "./summary";
import { askClaude, aiEnabled } from "./claude";
import { fits, templateFor } from "./checklists";
import { newId } from "./ids";

export const MAX_BYTES = 40 * 1024 * 1024;

export function titleFromFileName(name: string) {
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base[0].toUpperCase() + base.slice(1) : "Untitled file";
}

type AddInput = { roomId: string; folderId: string | null; fileName: string; data: Uint8Array; title?: string; hideFound?: boolean; sort?: boolean };

// Words that point a file to a folder when no checklist item names it.
const FOLDER_WORDS: Record<string, string[]> = {
  company: ["pitch", "deck", "overview", "one pager", "one-pager", "memo", "teaser"],
  financials: ["financial", "revenue", "budget", "forecast", "p&l", "balance sheet", "cash flow", "runway", "cap table", "tax", "invoice"],
  legal: ["agreement", "safe", "convertible", "incorporation", "bylaws", "certificate", "contract", "nda", "consent", "minutes", "license", "trademark", "patent", "assignment"],
  customers: ["customer", "client", "order form", "case study", "pilot", "survey", "testimonial"],
  product: ["roadmap", "product", "spec", "architecture", "demo", "design"],
  team: ["team", "hiring", "headcount", "org chart", "resume", "offer letter", "employee", "bio"],
};

/** Picks a folder for a new file: first from the checklist item it answers, then from words in it. */
export async function sortFolder(db: DB, roomId: string, haystack: string): Promise<string | null> {
  const [room] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, roomId));
  const folders = await db.select().from(schema.folders).where(eq(schema.folders.roomId, roomId));
  if (!room || !folders.length) return null;
  const byName = (name: string) => folders.find((f) => f.name.toLowerCase() === name.toLowerCase())?.id ?? null;
  for (const t of templateFor(room.purpose)) if (fits(t.match, haystack)) { const id = byName(t.folder); if (id) return id; }
  const h = haystack.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const f of folders) {
    const words = FOLDER_WORDS[f.name.toLowerCase()] ?? [f.name.toLowerCase()];
    const score = words.reduce((n, w) => n + (h.includes(w) ? 1 : 0), 0);
    if (score && (!best || score > best.score)) best = { id: f.id, score };
  }
  return best?.id ?? null;
}

export async function addDocument(db: DB, input: AddInput) {
  if (input.data.byteLength > MAX_BYTES) throw new Error("That file is over 40 MB.");
  if (!isPdf(input.data)) throw new Error("Only PDF files can be added for now.");
  const id = newId();
  const fileKey = `rooms/${input.roomId}/${id}/v1/original.pdf`;
  const pages = await processPdf(new Uint8Array(input.data));
  await putFile(fileKey, input.data);
  for (const p of pages) await putFile(`rooms/${input.roomId}/${id}/v1/p${p.number}.png`, p.png);
  const title = input.title?.trim() || titleFromFileName(input.fileName);
  const summary = await summarise(title, pages.map((p) => p.text));
  const haystack = `${input.fileName} ${title} ${pages[0]?.text.slice(0, 600) ?? ""}`;
  const folderId = input.sort ? await sortFolder(db, input.roomId, haystack) : input.folderId;
  await db.insert(schema.documents).values({
    id,
    roomId: input.roomId,
    folderId,
    title,
    fileName: input.fileName,
    fileKey,
    sizeBytes: input.data.byteLength,
    pageCount: pages.length,
    summary: summary.text,
    summarySource: summary.source,
  });
  await savePages(db, id, input.roomId, 1, pages, input.hideFound ?? true);
  await matchChecklist(db, input.roomId, id, haystack);
  return id;
}

/** Replaces a file with a new version. Links keep working; page time from before stays with the old pages. */
export async function newVersion(db: DB, documentId: string, fileName: string, data: Uint8Array) {
  if (data.byteLength > MAX_BYTES) throw new Error("That file is over 40 MB.");
  if (!isPdf(data)) throw new Error("Only PDF files can be added for now.");
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, documentId));
  if (!doc) throw new Error("File not found.");
  const v = doc.version + 1;
  const pages = await processPdf(new Uint8Array(data));
  const fileKey = `rooms/${doc.roomId}/${doc.id}/v${v}/original.pdf`;
  await putFile(fileKey, data);
  for (const p of pages) await putFile(`rooms/${doc.roomId}/${doc.id}/v${v}/p${p.number}.png`, p.png);
  const summary = await summarise(doc.title, pages.map((p) => p.text));
  await db.delete(schema.pages).where(eq(schema.pages.documentId, doc.id));
  await db.delete(schema.sensitiveItems).where(eq(schema.sensitiveItems.documentId, doc.id));
  await savePages(db, doc.id, doc.roomId, v, pages, true);
  await db
    .update(schema.documents)
    .set({ version: v, fileKey, fileName, sizeBytes: data.byteLength, pageCount: pages.length, summary: summary.text, summarySource: summary.source, updatedAt: new Date() })
    .where(eq(schema.documents.id, doc.id));
  await deleteFolder(`rooms/${doc.roomId}/${doc.id}/v${doc.version}`);
}

async function savePages(db: DB, documentId: string, roomId: string, version: number, pages: Awaited<ReturnType<typeof processPdf>>, hide: boolean) {
  if (!pages.length) return;
  await db.insert(schema.pages).values(
    pages.map((p) => ({ documentId, number: p.number, text: p.text, lines: p.lines, width: p.width, height: p.height, imageKey: `rooms/${roomId}/${documentId}/v${version}/p${p.number}.png` })),
  );
  const measure = await fontMeasure();
  const found = pages.flatMap((p) => findSensitive(p.lines, measure).map((f) => ({ ...f, page: p.number })));
  if (found.length) {
    await db.insert(schema.sensitiveItems).values(found.map((f) => ({ id: newId(), documentId, pageNumber: f.page, kind: f.kind, value: f.value, boxes: f.boxes, hidden: hide })));
  }
}

async function summarise(title: string, texts: string[]): Promise<{ text: string; source: "claude" | "local" }> {
  if (aiEnabled() && texts.some((t) => t.trim())) {
    const body = texts.map((t, i) => `(page ${i + 1}) ${t}`).join("\n").slice(0, 40000);
    const out = await askClaude(
      "Summarise this file from a company's data room for an investor in two or three plain sentences. Lead with the most important figures, quoted exactly. Leave out emails, phone numbers, ID numbers and account numbers. No headings, no lists, no em dashes.",
      `File: ${title}\n\n${body}`,
      300,
    );
    if (out) return { text: out, source: "claude" };
  }
  return { text: localSummary(texts), source: "local" };
}

/** Ticks off the first open template item this file fits. */
export async function matchChecklist(db: DB, roomId: string, documentId: string, haystack: string) {
  const items = await db.select().from(schema.checklistItems).where(and(eq(schema.checklistItems.roomId, roomId), eq(schema.checklistItems.status, "todo")));
  const hit = items.sort((a, b) => a.position - b.position).find((i) => (i.source === "expected" || i.source === "request") && fits(i.match, haystack));
  if (hit) await db.update(schema.checklistItems).set({ status: "done", documentId }).where(eq(schema.checklistItems.id, hit.id));
}

function isPdf(data: Uint8Array) {
  return data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46;
}
