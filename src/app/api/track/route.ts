import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { accessDoc } from "@/lib/access";

export const runtime = "nodejs";

const Body = z.object({ slug: z.string().min(10).max(40), documentId: z.string().min(4).max(40), page: z.number().int().min(1).max(5000), seconds: z.number().min(0.5).max(120) });

// Active reading time, sent by the viewer every few seconds while a page is on screen and the tab is in use.
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(JSON.parse(await req.text()));
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const access = await accessDoc(body.documentId, body.slug);
  if (!access || access.kind !== "viewer") return new Response("Not found", { status: 404 });
  const db = await getDb();
  await db
    .insert(schema.pageTime)
    .values({ visitId: access.visit.id, documentId: body.documentId, pageNumber: body.page, seconds: body.seconds })
    .onConflictDoUpdate({
      target: [schema.pageTime.visitId, schema.pageTime.documentId, schema.pageTime.pageNumber],
      set: { seconds: sql`${schema.pageTime.seconds} + ${body.seconds}` },
    });
  await db.update(schema.visits).set({ lastSeenAt: new Date() }).where(and(eq(schema.visits.id, access.visit.id)));
  return new Response(null, { status: 204 });
}
