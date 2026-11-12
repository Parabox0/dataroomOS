import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { personBySlug, linkClosed, canSee } from "@/lib/room";
import { currentVisit } from "@/lib/viewer";
import { Pages } from "@/components/pages";
import { plural } from "@/lib/text";

export const metadata = { title: "File", robots: { index: false } };

export default async function ViewerDoc({ params }: { params: Promise<{ slug: string; docId: string }> }) {
  const { slug, docId } = await params;
  const db = await getDb();
  const found = await personBySlug(db, slug);
  if (!found || linkClosed(found.person)) redirect(`/r/${slug}`);
  const visit = await currentVisit(db, found.person);
  if (!visit) redirect(`/r/${slug}`);
  const doc = await canSee(db, found.room.id, found.person.id, docId);
  if (!doc) redirect(`/r/${slug}`);
  const pages = await db.select({ number: schema.pages.number, width: schema.pages.width, height: schema.pages.height }).from(schema.pages).where(eq(schema.pages.documentId, doc.id)).orderBy(asc(schema.pages.number));
  return (
    <>
      <header className="viewer-head" style={{ position: "sticky", top: 0, zIndex: 5 }}>
        <div className="in">
          <Link href={`/r/${slug}`} className="small">Back to {found.room.company}</Link>
          <b className="grow" style={{ textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</b>
          {found.person.allowDownload ? <a className="btn btn-sm btn-light" href={`/api/download/${doc.id}?p=${slug}`}>Download</a> : <span className="meta">{plural(doc.pageCount, "page")}</span>}
        </div>
      </header>
      <main className="viewer">
        <Pages docId={doc.id} slug={slug} pages={pages.map((p) => ({ n: p.number, w: p.width, h: p.height }))} />
      </main>
    </>
  );
}
