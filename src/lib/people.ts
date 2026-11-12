import "server-only";
import { eq, inArray, desc } from "drizzle-orm";
import type { DB } from "./db";
import { schema } from "./db";
import { insightFor, type Insight } from "./insights";

/** Reading insights for everyone in a room. */
export async function roomInsights(db: DB, roomId: string): Promise<Map<string, Insight>> {
  const people = await db.select().from(schema.people).where(eq(schema.people.roomId, roomId));
  const visits = await db.select().from(schema.visits).where(eq(schema.visits.roomId, roomId)).orderBy(desc(schema.visits.startedAt));
  const time = visits.length ? await db.select().from(schema.pageTime).where(inArray(schema.pageTime.visitId, visits.map((v) => v.id))) : [];
  const docs = await db.select({ id: schema.documents.id, title: schema.documents.title }).from(schema.documents).where(eq(schema.documents.roomId, roomId));
  const asks = await db.select({ personId: schema.asks.personId, query: schema.asks.query }).from(schema.asks).where(eq(schema.asks.roomId, roomId)).orderBy(desc(schema.asks.createdAt));
  const qs = await db.select({ personId: schema.questions.personId, text: schema.questions.text }).from(schema.questions).where(eq(schema.questions.roomId, roomId)).orderBy(desc(schema.questions.createdAt));
  const titles = new Map(docs.map((d) => [d.id, d.title]));
  const out = new Map<string, Insight>();
  for (const p of people) {
    const pv = visits.filter((v) => v.personId === p.id);
    const ids = new Set(pv.map((v) => v.id));
    const asked = [...qs.filter((q) => q.personId === p.id).map((q) => q.text), ...asks.filter((a) => a.personId === p.id).map((a) => a.query)];
    out.set(p.id, insightFor(pv, time.filter((t) => ids.has(t.visitId)), titles, asked));
  }
  return out;
}
