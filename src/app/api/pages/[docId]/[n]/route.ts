import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { accessDoc } from "@/lib/access";
import { getFile } from "@/lib/storage";
import { stampPage } from "@/lib/pdf";
import { watermarkText } from "@/lib/viewer";

export const runtime = "nodejs";

// One page image. Viewers get hidden details and their watermark burned into the pixels.
export async function GET(req: Request, ctx: { params: Promise<{ docId: string; n: string }> }) {
  const { docId, n } = await ctx.params;
  const url = new URL(req.url);
  const access = await accessDoc(docId, url.searchParams.get("p"));
  if (!access) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const number = Number(n);
  const [page] = await db.select().from(schema.pages).where(and(eq(schema.pages.documentId, docId), eq(schema.pages.number, number))).limit(1);
  if (!page) return new Response("Not found", { status: 404 });
  let png = await getFile(page.imageKey);
  const asViewer = access.kind === "viewer" || url.searchParams.get("as") === "viewer";
  if (asViewer) {
    const items = await db.select().from(schema.sensitiveItems).where(and(eq(schema.sensitiveItems.documentId, docId), eq(schema.sensitiveItems.pageNumber, number), eq(schema.sensitiveItems.hidden, true)));
    const boxes = items.flatMap((i) => i.boxes);
    const watermark = access.kind === "viewer" && access.person.watermark ? watermarkText(access.person, access.visit) : null;
    png = await stampPage(png, { boxes, watermark });
  }
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
}
