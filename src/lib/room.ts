// Reading a room: which files a person can see, and the text of those files.
import "server-only";
import { and, eq, inArray, asc, isNotNull } from "drizzle-orm";
import type { DB } from "./db";
import { schema } from "./db";
import type { PageText } from "./search";

export type Person = typeof schema.people.$inferSelect;
export type Doc = typeof schema.documents.$inferSelect;
export type Folder = typeof schema.folders.$inferSelect;

export async function folderIdsFor(db: DB, personId: string): Promise<string[]> {
  const rows = await db.select({ f: schema.access.folderId }).from(schema.access).where(eq(schema.access.personId, personId));
  return rows.map((r) => r.f);
}

/** Files this person can see. personId null means the owner, who sees everything. */
export async function visibleDocs(db: DB, roomId: string, personId: string | null): Promise<Doc[]> {
  const base = and(eq(schema.documents.roomId, roomId), eq(schema.documents.status, "ready"));
  if (!personId) return db.select().from(schema.documents).where(base).orderBy(asc(schema.documents.title));
  const folders = await folderIdsFor(db, personId);
  if (!folders.length) return [];
  return db
    .select()
    .from(schema.documents)
    .where(and(base, isNotNull(schema.documents.folderId), inArray(schema.documents.folderId, folders)))
    .orderBy(asc(schema.documents.title));
}

export async function canSee(db: DB, roomId: string, personId: string | null, documentId: string): Promise<Doc | null> {
  const docs = await visibleDocs(db, roomId, personId);
  return docs.find((d) => d.id === documentId) ?? null;
}

/** Page text for the files a person can see. The AI never reads anything outside this. */
export async function pageTexts(db: DB, docs: Doc[]): Promise<PageText[]> {
  if (!docs.length) return [];
  const titles = new Map(docs.map((d) => [d.id, d.title]));
  const rows = await db
    .select({ documentId: schema.pages.documentId, page: schema.pages.number, text: schema.pages.text })
    .from(schema.pages)
    .where(inArray(schema.pages.documentId, docs.map((d) => d.id)))
    .orderBy(asc(schema.pages.documentId), asc(schema.pages.number));
  return rows.map((r) => ({ ...r, title: titles.get(r.documentId) ?? "File" }));
}

export async function personBySlug(db: DB, slug: string): Promise<{ person: Person; room: typeof schema.rooms.$inferSelect } | null> {
  const rows = await db
    .select({ person: schema.people, room: schema.rooms })
    .from(schema.people)
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.people.roomId))
    .where(eq(schema.people.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/** Why a link does not open, in plain words, or null if it is open. */
export function linkClosed(p: Person): string | null {
  if (p.revoked) return "The owner turned this link off.";
  if (p.expiresAt && p.expiresAt.getTime() < Date.now()) return "This link has expired.";
  return null;
}
