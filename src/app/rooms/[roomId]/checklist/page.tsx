import Link from "next/link";
import { asc, eq, and } from "drizzle-orm";
import { requireRoom } from "@/lib/auth";
import { schema } from "@/lib/db";
import { roomInsights } from "@/lib/people";
import { toggleChecklistItem, addChecklistItem, deleteChecklistItem, linkChecklistItem } from "@/app/actions/room";
import { CheckForm } from "@/components/toggles";
import { Submit } from "@/components/forms";
import { plural } from "@/lib/text";

export const metadata = { title: "Checklist" };

export default async function Checklist({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ view?: string }> }) {
  const { roomId } = await params;
  const view = (await searchParams).view ?? "todo";
  const { room, db } = await requireRoom(roomId);
  const items = await db.select().from(schema.checklistItems).where(eq(schema.checklistItems.roomId, room.id)).orderBy(asc(schema.checklistItems.position));
  const docs = await db.select({ id: schema.documents.id, title: schema.documents.title }).from(schema.documents).where(eq(schema.documents.roomId, room.id)).orderBy(asc(schema.documents.title));
  const titles = new Map(docs.map((d) => [d.id, d.title]));
  const counted = items.filter((i) => i.source !== "request");
  const ready = counted.filter((i) => i.status === "done").length;
  const shown =
    view === "done" ? items.filter((i) => i.status === "done") : view === "requests" ? items.filter((i) => i.source === "request") : items.filter((i) => i.status === "todo" && i.source !== "request");

  const open = await db.select().from(schema.questions).where(and(eq(schema.questions.roomId, room.id), eq(schema.questions.status, "open")));
  const people = await db.select().from(schema.people).where(eq(schema.people.roomId, room.id));
  const insights = await roomInsights(db, room.id);
  const leaning = people.filter((p) => insights.get(p.id)?.leaningIn && p.kind === "person");
  const base = `/rooms/${room.id}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{view === "done" ? "Done" : view === "requests" ? "Requests" : "Checklist"}</h1>
          <p className="muted">{ready} of {counted.length} ready. The checklist is the room: each item is a file someone will expect.</p>
        </div>
        <Link href={`${base}/check`} className="btn btn-sm">Check the room</Link>
      </div>
      <div className="progress" aria-hidden><span style={{ width: `${counted.length ? (ready / counted.length) * 100 : 0}%` }} /></div>

      {view === "todo" && (open.length > 0 || leaning.length > 0) && (
        <div className="card card-flush" aria-label="Needs you">
          <ul className="list">
            {open.length > 0 && (
              <li><span className="dot" aria-hidden /><Link className="item grow" href={`${base}/questions`}><p className="title">{plural(open.length, "question")} waiting for you</p><p className="meta">A reply is drafted from your files for each one.</p></Link></li>
            )}
            {leaning.map((p) => (
              <li key={p.id}><span className="dot" aria-hidden /><Link className="item grow" href={`${base}/people/${p.id}`}><p className="title">{p.name}{p.company ? `, ${p.company}` : ""} is leaning in</p><p className="meta">{insights.get(p.id)!.sentence}</p></Link></li>
            ))}
          </ul>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card">
          <p>{view === "done" ? "Nothing is ticked off yet. Add a file and it ticks off the item it fits." : view === "requests" ? "No requests. When a viewer asks for a file you don't have, it shows up here." : "Everything on the list is done. Run Check the room before you share it."}</p>
        </div>
      ) : (
        <div className="card card-flush">
          <ul className="list">
            {shown.map((i) => (
              <li key={i.id} style={{ alignItems: "flex-start" }}>
                <div style={{ marginTop: 2 }}>
                  <CheckForm action={toggleChecklistItem} hidden={{ roomId: room.id, itemId: i.id }} done={i.status === "done"} label={`Mark ${i.title} as ${i.status === "done" ? "not done" : "done"}`} />
                </div>
                <div className="grow">
                  <p className="title">{i.title}</p>
                  {i.detail && <p className="meta">{i.detail}</p>}
                  {(i.source === "check" || i.source === "request" || (i.documentId && titles.has(i.documentId))) && (
                    <div className="row wrap" style={{ marginTop: 6, gap: 8 }}>
                      {i.source === "check" && <span className="tag">Found by Check the room</span>}
                      {i.source === "request" && <span className="tag">Requested</span>}
                      {i.documentId && titles.has(i.documentId) && <Link className="small" href={`${base}/documents/${i.documentId}`}>{titles.get(i.documentId)}</Link>}
                    </div>
                  )}
                </div>
                {!(i.documentId && titles.has(i.documentId)) && i.source !== "check" && (
                  <form action={linkChecklistItem} className="row pick">
                    <input type="hidden" name="roomId" value={room.id} />
                    <input type="hidden" name="itemId" value={i.id} />
                    <label className="sr-only" htmlFor={`f-${i.id}`}>File for {i.title}</label>
                    <select id={`f-${i.id}`} name="documentId" className="input" defaultValue="" required>
                      <option value="" disabled>Link a file…</option>
                      {docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                    <Submit className="btn btn-sm btn-light">Link</Submit>
                  </form>
                )}
                {i.source !== "expected" && (
                  <form action={deleteChecklistItem}>
                    <input type="hidden" name="roomId" value={room.id} />
                    <input type="hidden" name="itemId" value={i.id} />
                    <Submit className="btn-quiet btn-danger" aria-label={`Remove ${i.title}`}>Remove</Submit>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "todo" && (
        <form action={addChecklistItem} className="row on-card card" style={{ padding: 12 }}>
          <input type="hidden" name="roomId" value={room.id} />
          <label className="sr-only" htmlFor="new-item">New item</label>
          <input id="new-item" className="input grow" name="title" placeholder="Add your own item, like “Bank statements”" required />
          <Submit className="btn btn-sm">Add</Submit>
        </form>
      )}
    </>
  );
}
