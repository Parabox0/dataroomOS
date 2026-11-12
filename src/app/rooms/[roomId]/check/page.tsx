import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { requireRoom } from "@/lib/auth";
import { schema } from "@/lib/db";
import { runCheck, toggleChecklistItem } from "@/app/actions/room";
import { Submit } from "@/components/forms";
import { CheckForm } from "@/components/toggles";
import { aiEnabled } from "@/lib/claude";
import { plural } from "@/lib/text";

export const metadata = { title: "Check the room" };

export default async function Check({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ ran?: string }> }) {
  const { roomId } = await params;
  const ran = (await searchParams).ran === "1";
  const { room, db } = await requireRoom(roomId);
  const found = await db.select().from(schema.checklistItems).where(and(eq(schema.checklistItems.roomId, room.id), eq(schema.checklistItems.source, "check"))).orderBy(asc(schema.checklistItems.status), asc(schema.checklistItems.position));
  const missing = await db.select().from(schema.checklistItems).where(and(eq(schema.checklistItems.roomId, room.id), eq(schema.checklistItems.source, "expected"), eq(schema.checklistItems.status, "todo"))).orderBy(asc(schema.checklistItems.position));
  const open = found.filter((f) => f.status === "todo");
  const base = `/rooms/${room.id}`;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Check the room</h1>
          <p className="muted">Reads every file the way a careful investor would, then lists what to fix before you share.</p>
        </div>
        <form action={runCheck}>
          <input type="hidden" name="roomId" value={room.id} />
          <Submit pending="Checking…">{found.length ? "Check again" : "Check the room"}</Submit>
        </form>
      </div>
      {!found.length && !missing.length && !ran ? (
        <div className="card"><p>Nothing checked yet. It takes a few seconds and changes nothing in your files.</p></div>
      ) : (
        <>
          <p className="muted" role="status">{open.length + missing.length === 0 ? "Nothing to fix. The room is ready to share." : `${plural(open.length + missing.length, "thing")} to look at.`}</p>
          {open.length > 0 && (
            <div className="card card-flush"><ul className="list">
              {found.map((f) => (
                <li key={f.id} style={{ alignItems: "flex-start" }}>
                  <div style={{ marginTop: 1 }}><CheckForm action={toggleChecklistItem} hidden={{ roomId: room.id, itemId: f.id }} done={f.status === "done"} label={`Mark ${f.title} as ${f.status === "done" ? "not fixed" : "fixed"}`} /></div>
                  <div className="grow">
                    <p className="title">{f.title}</p>
                    <p className="meta">{f.detail}</p>
                    {f.documentId && <Link className="small" href={`${base}/documents/${f.documentId}`}>Open the file</Link>}
                  </div>
                </li>
              ))}
            </ul></div>
          )}
          {missing.length > 0 && (
            <div className="stack" style={{ ["--gap" as string]: "8px" }}>
              <h2>Still missing</h2>
              <div className="card card-flush"><ul className="list">
                {missing.map((m) => (
                  <li key={m.id}><div className="grow"><p className="title">{m.title}</p><p className="meta">{m.detail}</p></div><Link className="small" href={`${base}/documents?add=1#add`}>Add file</Link></li>
                ))}
              </ul></div>
            </div>
          )}
          <p className="meta">{aiEnabled() ? "Built-in checks, plus Claude looking for facts that disagree between files." : "Built-in checks. Add an OpenRouter or Anthropic key and Claude also looks for facts that disagree between files."}</p>
        </>
      )}
    </>
  );
}
