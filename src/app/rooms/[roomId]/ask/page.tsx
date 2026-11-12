import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireRoom } from "@/lib/auth";
import { schema } from "@/lib/db";
import { ownerAsk } from "@/app/actions/room";
import { Submit } from "@/components/forms";
import { AnswerView } from "@/components/answer";
import { aiEnabled } from "@/lib/claude";

export const metadata = { title: "Ask the room" };

const SUGGEST = ["What is the runway after the round?", "Who owns the company today?", "How much do the top five customers pay?"];

export default async function Ask({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ a?: string }> }) {
  const { roomId } = await params;
  const { a } = await searchParams;
  const { room, db } = await requireRoom(roomId);
  const [current] = a ? await db.select().from(schema.asks).where(and(eq(schema.asks.id, a), eq(schema.asks.roomId, room.id))) : [];
  const recent = await db.select().from(schema.asks).where(and(eq(schema.asks.roomId, room.id), isNull(schema.asks.personId))).orderBy(desc(schema.asks.createdAt)).limit(6);
  const base = `/rooms/${room.id}`;
  return (
    <>
      <div className="page-head"><div>
        <h1>Ask the room</h1>
        <p className="muted">Search or ask in plain words. Every answer shows where it came from. {aiEnabled() ? "Answers are written by Claude." : "Claude is off, so answers quote the closest lines from your files."}</p>
      </div></div>
      <form action={ownerAsk} className="askbox">
        <input type="hidden" name="roomId" value={room.id} />
        <label className="sr-only" htmlFor="q">Search or ask</label>
        <input id="q" className="input grow" name="q" defaultValue={current?.query} placeholder="Search or ask, like “what is the burn rate?”" required autoFocus={!current} />
        <Submit pending="Reading…">Ask</Submit>
      </form>
      {current ? (
        <div className="card">
          <AnswerView text={current.answer} sources={current.sources} mode={current.mode} hrefFor={(s) => `${base}/documents/${s.documentId}#p${s.page}`} />
        </div>
      ) : (
        <div className="row wrap" style={{ gap: 8 }}>
          {SUGGEST.map((q) => (
            <form key={q} action={ownerAsk}><input type="hidden" name="roomId" value={room.id} /><input type="hidden" name="q" value={q} /><Submit className="btn btn-sm btn-light">{q}</Submit></form>
          ))}
        </div>
      )}
      {recent.filter((r) => r.id !== current?.id).length > 0 && (
        <div className="stack" style={{ ["--gap" as string]: "8px" }}>
          <h2>Earlier</h2>
          <div className="card card-flush"><ul className="list">
            {recent.filter((r) => r.id !== current?.id).map((r) => (
              <li key={r.id}><Link className="item grow" href={`${base}/ask?a=${r.id}`}><p className="title">{r.query}</p></Link></li>
            ))}
          </ul></div>
        </div>
      )}
    </>
  );
}
