import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import type { DB } from "./db";
import { schema } from "./db";
import { roomInsights } from "./people";

export type RoomNav = {
  folders: { id: string; name: string; count: number }[];
  total: number;
  unfiled: number;
  todo: number;
  done: number;
  requests: number;
  open: number;
  answered: number;
  people: number;
  leaningIn: number;
};

export async function roomNav(db: DB, roomId: string): Promise<RoomNav> {
  const folders = await db.select().from(schema.folders).where(eq(schema.folders.roomId, roomId)).orderBy(asc(schema.folders.position));
  const counts = await db.select({ folderId: schema.documents.folderId, n: sql<number>`count(*)::int` }).from(schema.documents).where(eq(schema.documents.roomId, roomId)).groupBy(schema.documents.folderId);
  const items = await db.select({ status: schema.checklistItems.status, source: schema.checklistItems.source }).from(schema.checklistItems).where(eq(schema.checklistItems.roomId, roomId));
  const qs = await db.select({ status: schema.questions.status }).from(schema.questions).where(eq(schema.questions.roomId, roomId));
  const people = await db.select({ id: schema.people.id }).from(schema.people).where(and(eq(schema.people.roomId, roomId), eq(schema.people.revoked, false)));
  const insights = await roomInsights(db, roomId);
  const byFolder = new Map(counts.map((c) => [c.folderId, c.n]));
  return {
    folders: folders.map((f) => ({ id: f.id, name: f.name, count: byFolder.get(f.id) ?? 0 })),
    total: counts.reduce((a, c) => a + c.n, 0),
    unfiled: byFolder.get(null) ?? 0,
    todo: items.filter((i) => i.status === "todo" && i.source !== "request").length,
    done: items.filter((i) => i.status === "done").length,
    requests: items.filter((i) => i.source === "request" && i.status === "todo").length,
    open: qs.filter((q) => q.status === "open").length,
    answered: qs.filter((q) => q.status === "answered").length,
    people: people.length,
    leaningIn: people.filter((p) => insights.get(p.id)?.leaningIn).length,
  };
}
