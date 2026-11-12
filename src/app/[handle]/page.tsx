import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getDb, schema } from "@/lib/db";
import { handleProblem, publicPerson } from "@/lib/handle";
import ViewerRoom from "../r/[slug]/page";
import { Closed } from "../r/[slug]/shell";

// The short room address, like yourdomain.com/brightloaf. It opens the room's "Anyone with the link" share.

async function roomFor(handle: string) {
  if (handleProblem(handle)) return null;
  const db = await getDb();
  const [room] = await db.select().from(schema.rooms).where(eq(schema.rooms.handle, handle)).limit(1);
  return room ? { db, room } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const found = await roomFor((await params).handle);
  return { title: found ? `${found.room.company} data room` : "Data room", robots: { index: false } };
}

export default async function RoomByHandle({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ a?: string }> }) {
  const found = await roomFor((await params).handle);
  if (!found) notFound();
  const person = await publicPerson(found.db, found.room.id);
  if (!person) return <Closed text={`${found.room.company} hasn’t opened this address to the public. Ask them for your own link.`} />;
  return <ViewerRoom params={Promise.resolve({ slug: person.slug })} searchParams={searchParams} />;
}
