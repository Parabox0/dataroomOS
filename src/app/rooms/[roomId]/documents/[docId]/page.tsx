import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireRoom } from "@/lib/auth";
import { schema } from "@/lib/db";
import { setHidden, updateDoc, deleteDoc } from "@/app/actions/room";
import { SwitchForm } from "@/components/toggles";
import { Submit } from "@/components/forms";
import { Pages } from "@/components/pages";
import { VersionForm } from "../upload";
import { minutes, plural } from "@/lib/text";

export const metadata = { title: "File" };

export default async function DocPage({ params, searchParams }: { params: Promise<{ roomId: string; docId: string }>; searchParams: Promise<{ as?: string }> }) {
  const { roomId, docId } = await params;
  const asViewer = (await searchParams).as === "viewer";
  const { room, db } = await requireRoom(roomId);
  const [doc] = await db.select().from(schema.documents).where(and(eq(schema.documents.id, docId), eq(schema.documents.roomId, room.id)));
  if (!doc) notFound();
  const pages = await db.select({ number: schema.pages.number, width: schema.pages.width, height: schema.pages.height }).from(schema.pages).where(eq(schema.pages.documentId, doc.id)).orderBy(asc(schema.pages.number));
  const sensitive = await db.select().from(schema.sensitiveItems).where(eq(schema.sensitiveItems.documentId, doc.id)).orderBy(asc(schema.sensitiveItems.pageNumber));
  const folders = await db.select().from(schema.folders).where(eq(schema.folders.roomId, room.id)).orderBy(asc(schema.folders.position));
  const people = await db.select().from(schema.people).where(eq(schema.people.roomId, room.id));
  const access = people.length ? await db.select().from(schema.access).where(inArray(schema.access.personId, people.map((p) => p.id))) : [];
  const canSee = doc.folderId ? people.filter((p) => access.some((a) => a.personId === p.id && a.folderId === doc.folderId) && !p.revoked) : [];
  const time = await db
    .select({ seconds: schema.pageTime.seconds, page: schema.pageTime.pageNumber, personId: schema.visits.personId, email: schema.visits.email })
    .from(schema.pageTime)
    .innerJoin(schema.visits, eq(schema.visits.id, schema.pageTime.visitId))
    .where(eq(schema.pageTime.documentId, doc.id));
  const perPage = pages.map((p) => time.filter((t) => t.page === p.number).reduce((a, t) => a + t.seconds, 0));
  const peak = Math.max(1, ...perPage);
  const perPerson = people
    .map((p) => ({ p, s: time.filter((t) => t.personId === p.id).reduce((a, t) => a + t.seconds, 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const base = `/rooms/${room.id}`;
  const hiddenCount = sensitive.filter((s) => s.hidden).length;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="meta"><Link href={`${base}/documents${doc.folderId ? `?folder=${doc.folderId}` : ""}`}>{doc.folderId ? folders.find((f) => f.id === doc.folderId)?.name : "No folder"}</Link></p>
          <h1>{doc.title}</h1>
          <p className="muted">{plural(doc.pageCount, "page")} · version {doc.version} · {canSee.length ? `${plural(canSee.length, "person", "people")} can see it` : "Only you can see it"}</p>
        </div>
        <a className="btn btn-sm btn-light" href={`/api/download/${doc.id}`}>Download original</a>
      </div>

      <div className="card stack" style={{ ["--gap" as string]: "8px" }}>
        <h2>Summary</h2>
        <p>{doc.summary}</p>
        <p className="meta">{doc.summarySource === "claude" ? "Written by Claude." : "Built-in summary: the file’s own most informative sentences."}</p>
      </div>

      <div className="card card-flush">
        <div style={{ padding: "18px 20px 6px" }}>
          <h2>Personal details</h2>
          <p className="meta" style={{ marginTop: 4 }}>
            {sensitive.length ? `${plural(sensitive.length, "detail")} found. ${hiddenCount} hidden from viewers.` : "Nothing found that looks like an email, phone, ID or account number."}
          </p>
        </div>
        {sensitive.length > 0 && (
          <>
            <ul className="list">
              {sensitive.map((s) => (
                <li key={s.id} className="between">
                  <div className="grow"><p className="title">{s.value}</p><p className="meta">{s.kind}, page {s.pageNumber}</p></div>
                  <span className="meta" aria-hidden>{s.hidden ? "Hidden" : "Visible"}</span>
                  <SwitchForm action={setHidden} hidden={{ roomId: room.id, documentId: doc.id, itemId: s.id, hidden: s.hidden ? "0" : "1" }} on={s.hidden} label={`Hide ${s.value} from viewers`} />
                </li>
              ))}
            </ul>
            {hiddenCount < sensitive.length && (
              <form action={setHidden} style={{ padding: "4px 20px 16px" }}>
                <input type="hidden" name="roomId" value={room.id} /><input type="hidden" name="documentId" value={doc.id} /><input type="hidden" name="itemId" value="all" /><input type="hidden" name="hidden" value="1" />
                <Submit className="btn btn-sm">Hide all</Submit>
              </form>
            )}
          </>
        )}
      </div>

      <div className="card stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Who read it</h2>
        {perPerson.length === 0 ? (
          <p className="muted">Nobody has opened it yet.</p>
        ) : (
          <>
            <ul className="list" style={{ margin: "0 -20px" }}>
              {perPerson.map(({ p, s }) => (
                <li key={p.id} className="between"><Link href={`${base}/people/${p.id}`} className="grow">{p.name}{p.company ? `, ${p.company}` : ""}</Link><span className="meta">{minutes(s)}</span></li>
              ))}
            </ul>
            <div className="heat" aria-label="Reading time by page">
              {perPage.map((s, i) => (
                <div key={i} className="row" style={{ gap: 10 }}>
                  <a className="small" href={`#p${i + 1}`} style={{ width: 56 }}>Page {i + 1}</a>
                  <div className="grow"><div className="bar" style={{ width: `${Math.max(1, (s / peak) * 100)}%`, opacity: s ? 1 : 0.15 }} /></div>
                  <span className="meta" style={{ width: 56, textAlign: "right" }}>{s ? minutes(s) : "none"}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Edit file</summary>
        <div className="stack" style={{ marginTop: 14, ["--gap" as string]: "16px" }}>
          <form action={updateDoc} className="stack on-card" style={{ ["--gap" as string]: "10px" }}>
            <input type="hidden" name="roomId" value={room.id} /><input type="hidden" name="documentId" value={doc.id} />
            <label className="field"><span>Name</span><input className="input" name="title" defaultValue={doc.title} /></label>
            <label className="field"><span>Folder</span>
              <select className="input" name="folderId" defaultValue={doc.folderId ?? ""}>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                <option value="">No folder (only you can see it)</option>
              </select>
            </label>
            <div><Submit className="btn btn-sm">Save</Submit></div>
          </form>
          <VersionForm roomId={room.id} documentId={doc.id} version={doc.version} />
          <form action={deleteDoc}>
            <input type="hidden" name="roomId" value={room.id} /><input type="hidden" name="documentId" value={doc.id} />
            <Submit className="btn-quiet btn-danger">Delete this file</Submit>
          </form>
        </div>
      </details>

      <div className="row between wrap">
        <h2>Pages</h2>
        <Link className="small" href={asViewer ? `${base}/documents/${doc.id}` : `${base}/documents/${doc.id}?as=viewer`}>{asViewer ? "See the original" : "See it as a viewer"}</Link>
      </div>
      {!asViewer && hiddenCount > 0 && <p className="meta">Blue outlines show what viewers see blacked out.</p>}
      <Pages
        docId={doc.id}
        ownerPreview={asViewer}
        pages={pages.map((p) => ({ n: p.number, w: p.width, h: p.height, outlines: asViewer ? [] : sensitive.filter((s) => s.hidden && s.pageNumber === p.number).flatMap((s) => s.boxes) }))}
      />
    </>
  );
}
