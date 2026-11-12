// A viewer's visit. Opening a link creates a visit; a signed cookie ties later page reads to it.
import "server-only";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import type { DB } from "./db";
import { schema } from "./db";
import { sign, unsign } from "./crypto";
import { secureCookies } from "./auth";
import { newId } from "./ids";
import type { Person } from "./room";

const name = (personId: string) => `dr_v_${personId}`;

export type Visit = typeof schema.visits.$inferSelect;

export async function currentVisit(db: DB, person: Person): Promise<Visit | null> {
  const raw = (await cookies()).get(name(person.id))?.value;
  const id = unsign(raw);
  if (!id) return null;
  const [v] = await db.select().from(schema.visits).where(and(eq(schema.visits.id, id), eq(schema.visits.personId, person.id))).limit(1);
  if (!v) return null;
  if (person.requireNda && !v.ndaAcceptedAt) return null;
  return v;
}

export async function startVisit(db: DB, person: Person, info: { email: string | null; name: string | null; nda: boolean }) {
  const id = newId();
  await db.insert(schema.visits).values({ id, personId: person.id, roomId: person.roomId, email: info.email, name: info.name, ndaAcceptedAt: info.nda ? new Date() : null });
  (await cookies()).set(name(person.id), sign(id), { httpOnly: true, sameSite: "lax", secure: secureCookies(), path: "/", maxAge: 60 * 60 * 12 });
  return id;
}

/** The text burned into every page a viewer sees. */
export function watermarkText(person: Person, visit: Visit) {
  const who = visit.email || visit.name || person.name;
  const day = visit.startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${who}  ·  ${day}`;
}
