import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "./db";
import { schema } from "./db";
import { runChecks, type Finding } from "./checks";
import { aiEnabled, askClaude } from "./claude";
import { newId } from "./ids";

/** Runs Check the room and saves what it finds as checklist items. Returns the findings. */
export async function checkRoom(db: DB, roomId: string): Promise<{ findings: Finding[]; mode: "claude" | "local" }> {
  const docs = await db.select().from(schema.documents).where(eq(schema.documents.roomId, roomId));
  const ids = docs.map((d) => d.id);
  const pages = ids.length ? await db.select({ documentId: schema.pages.documentId, number: schema.pages.number, text: schema.pages.text }).from(schema.pages).where(inArray(schema.pages.documentId, ids)) : [];
  const sensitive = ids.length ? await db.select().from(schema.sensitiveItems).where(inArray(schema.sensitiveItems.documentId, ids)) : [];
  const checklist = await db.select().from(schema.checklistItems).where(eq(schema.checklistItems.roomId, roomId));
  const people = await db.select({ id: schema.people.id }).from(schema.people).where(and(eq(schema.people.roomId, roomId), eq(schema.people.revoked, false)));
  const access = people.length ? await db.select().from(schema.access).where(inArray(schema.access.personId, people.map((p) => p.id))) : [];

  const checkDocs = docs.map((d) => ({ id: d.id, title: d.title, folderId: d.folderId, pages: pages.filter((p) => p.documentId === d.id).sort((a, b) => a.number - b.number) }));
  const findings = runChecks({ docs: checkDocs, checklist, sensitive, sharedFolderIds: new Set(access.map((a) => a.folderId)) });

  let mode: "claude" | "local" = "local";
  if (aiEnabled() && checkDocs.length) {
    const extra = await claudeConsistency(checkDocs);
    if (extra) {
      mode = "claude";
      findings.push(...extra);
    }
  }

  // Replace earlier check results, but keep ones the owner already marked done.
  const old = checklist.filter((c) => c.source === "check");
  const doneKeys = new Set(old.filter((c) => c.status === "done").map((c) => c.match));
  const toDelete = old.filter((c) => c.status !== "done").map((c) => c.id);
  if (toDelete.length) await db.delete(schema.checklistItems).where(inArray(schema.checklistItems.id, toDelete));
  const fresh = findings.filter((f) => !f.key.startsWith("missing:") && !doneKeys.has(f.key));
  const max = checklist.reduce((a, c) => Math.max(a, c.position), 0);
  if (fresh.length) {
    await db.insert(schema.checklistItems).values(
      fresh.map((f, i) => ({ id: newId(), roomId, title: f.title, detail: f.detail, source: "check", status: "todo", documentId: f.documentId ?? null, match: f.key, position: max + 1 + i })),
    );
  }
  return { findings, mode };
}

async function claudeConsistency(docs: { id: string; title: string; pages: { number: number; text: string }[] }[]): Promise<Finding[] | null> {
  const body = docs.map((d) => `### ${d.title}\n` + d.pages.map((p) => `(page ${p.number}) ${p.text.slice(0, 2500)}`).join("\n")).join("\n\n").slice(0, 60000);
  const text = await askClaude(
    `You review a startup's data room the way a careful investor would. Find at most 3 places where two files disagree on a fact (a number, a date, a name). Only report real disagreements you can quote. Reply with JSON only: [{"title": "short instruction, under 8 words", "detail": "one plain sentence naming both files and both values", "file": "exact file title"}]. Reply [] if there are none. No em dashes.`,
    body,
    800,
  );
  if (!text) return null;
  try {
    const json = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as { title: string; detail: string; file?: string }[];
    return json.slice(0, 3).map((j, i) => ({ key: `ai:${i}:${j.title}`, title: j.title, detail: j.detail, documentId: docs.find((d) => d.title === j.file)?.id }));
  } catch {
    return [];
  }
}
