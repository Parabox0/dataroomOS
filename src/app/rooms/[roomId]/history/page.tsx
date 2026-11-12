import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { requireRoom } from "@/lib/auth";
import { schema } from "@/lib/db";
import { minutes } from "@/lib/text";

export const metadata = { title: "History" };

type E = { at: Date; text: string; href?: string };

export default async function History({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { room, db } = await requireRoom(roomId);
  const base = `/rooms/${room.id}`;
  const people = await db.select().from(schema.people).where(eq(schema.people.roomId, room.id));
  const who = new Map(people.map((p) => [p.id, p]));
  const docs = await db.select().from(schema.documents).where(eq(schema.documents.roomId, room.id));
  const titles = new Map(docs.map((d) => [d.id, d.title]));
  const visits = await db.select().from(schema.visits).where(eq(schema.visits.roomId, room.id)).orderBy(desc(schema.visits.startedAt)).limit(200);
  const time = visits.length ? await db.select().from(schema.pageTime).where(inArray(schema.pageTime.visitId, visits.map((v) => v.id))) : [];
  const downloads = visits.length ? await db.select().from(schema.downloads).where(inArray(schema.downloads.visitId, visits.map((v) => v.id))) : [];
  const asks = await db.select().from(schema.asks).where(eq(schema.asks.roomId, room.id)).orderBy(desc(schema.asks.createdAt)).limit(100);
  const questions = await db.select().from(schema.questions).where(eq(schema.questions.roomId, room.id));
  const name = (personId: string, v?: { name: string | null; email: string | null }) => {
    const p = who.get(personId);
    if (p?.kind === "anyone") return v?.name || v?.email || "Someone with the link";
    return p?.name ?? "Someone";
  };
  const events: E[] = [];
  for (const v of visits) {
    const t = time.filter((x) => x.visitId === v.id);
    const total = t.reduce((a, x) => a + x.seconds, 0);
    const files = [...new Set(t.map((x) => titles.get(x.documentId)).filter(Boolean))];
    events.push({ at: v.startedAt, text: total ? `${name(v.personId, v)} read for ${minutes(total)}: ${files.join(", ")}` : `${name(v.personId, v)} opened the room`, href: `${base}/people/${v.personId}` });
  }
  for (const d of downloads) {
    const v = visits.find((x) => x.id === d.visitId)!;
    events.push({ at: d.at, text: `${name(v.personId, v)} downloaded ${titles.get(d.documentId) ?? "a file"}`, href: `${base}/documents/${d.documentId}` });
  }
  for (const a of asks) events.push({ at: a.createdAt, text: `${a.personId ? name(a.personId) : "You"} asked “${a.query}”`, href: a.personId ? `${base}/people/${a.personId}` : `${base}/ask?a=${a.id}` });
  for (const q of questions) {
    events.push({ at: q.createdAt, text: `${q.askerName || name(q.personId)} sent a question: “${q.text}”`, href: `${base}/questions` });
    if (q.answeredAt) events.push({ at: q.answeredAt, text: `You answered ${q.askerName || name(q.personId)}`, href: `${base}/questions?view=answered` });
  }
  for (const d of docs) events.push({ at: d.createdAt, text: `You added ${d.title}`, href: `${base}/documents/${d.id}` });
  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  const day = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const groups: [string, E[]][] = [];
  for (const e of events) {
    const k = day(e.at);
    const g = groups.at(-1);
    if (g && g[0] === k) g[1].push(e);
    else groups.push([k, [e]]);
  }
  return (
    <>
      <div className="page-head"><div><h1>History</h1><p className="muted">Everything that happened in the room, newest first.</p></div></div>
      {groups.length === 0 && <div className="card"><p>Nothing has happened yet.</p></div>}
      {groups.map(([d, es]) => (
        <div key={d} className="stack" style={{ ["--gap" as string]: "8px" }}>
          <h2 style={{ fontSize: 15 }}>{d}</h2>
          <div className="card card-flush"><ul className="list">
            {es.map((e, i) => (
              <li key={i} style={{ alignItems: "flex-start" }}>
                <span className="meta" style={{ width: 68, flex: "none" }}>{e.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                {e.href ? <Link href={e.href} className="item grow">{e.text}</Link> : <span className="grow">{e.text}</span>}
              </li>
            ))}
          </ul></div>
        </div>
      ))}
    </>
  );
}
