// Who is asking for a file: the owner (signed in) or a viewer (through their link and visit cookie).
import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { currentUser } from "./auth";
import { personBySlug, linkClosed, canSee, type Person, type Doc } from "./room";
import { currentVisit, type Visit } from "./viewer";

export type Access =
  | { kind: "owner"; doc: Doc }
  | { kind: "viewer"; doc: Doc; person: Person; visit: Visit };

export async function accessDoc(documentId: string, slug: string | null): Promise<Access | null> {
  const db = await getDb();
  if (slug) {
    const found = await personBySlug(db, slug);
    if (!found || linkClosed(found.person)) return null;
    const visit = await currentVisit(db, found.person);
    if (!visit) return null;
    const doc = await canSee(db, found.room.id, found.person.id, documentId);
    if (!doc) return null;
    return { kind: "viewer", doc, person: found.person, visit };
  }
  const user = await currentUser();
  if (!user) return null;
  const rows = await db
    .select({ doc: schema.documents })
    .from(schema.documents)
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.documents.roomId))
    .where(and(eq(schema.documents.id, documentId), eq(schema.rooms.ownerId, user.id)))
    .limit(1);
  return rows[0] ? { kind: "owner", doc: rows[0].doc } : null;
}
