import { and, eq, asc } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { getDb, schema } from "@/lib/db";
import { accessDoc } from "@/lib/access";
import { getFile } from "@/lib/storage";
import { stampPage } from "@/lib/pdf";
import { watermarkText } from "@/lib/viewer";
import { newId } from "@/lib/ids";

export const runtime = "nodejs";

// Owners get the original file. Viewers get a PDF rebuilt from the stamped pages,
// so hidden details and the watermark come with it.
export async function GET(req: Request, ctx: { params: Promise<{ docId: string }> }) {
  const { docId } = await ctx.params;
  const access = await accessDoc(docId, new URL(req.url).searchParams.get("p"));
  if (!access) return new Response("Not found", { status: 404 });
  const name = access.doc.title.replace(/[^a-z0-9 ._-]/gi, "").trim() || "file";
  if (access.kind === "owner") {
    const data = await getFile(access.doc.fileKey);
    return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
  }
  if (!access.person.allowDownload) return new Response("Downloads are off for this link.", { status: 403 });
  const db = await getDb();
  const pages = await db.select().from(schema.pages).where(eq(schema.pages.documentId, docId)).orderBy(asc(schema.pages.number));
  const hidden = await db.select().from(schema.sensitiveItems).where(and(eq(schema.sensitiveItems.documentId, docId), eq(schema.sensitiveItems.hidden, true)));
  const watermark = access.person.watermark ? watermarkText(access.person, access.visit) : null;
  const pdf = await PDFDocument.create();
  for (const p of pages) {
    const png = await stampPage(await getFile(p.imageKey), { boxes: hidden.filter((h) => h.pageNumber === p.number).flatMap((h) => h.boxes), watermark });
    const img = await pdf.embedPng(png);
    const w = 612;
    const h = (p.height / p.width) * w;
    pdf.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
  }
  await db.insert(schema.downloads).values({ id: newId(), visitId: access.visit.id, documentId: docId });
  return new Response(new Uint8Array(await pdf.save()), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
}
