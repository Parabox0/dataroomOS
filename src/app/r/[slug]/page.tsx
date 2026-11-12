import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { personBySlug, linkClosed, visibleDocs } from "@/lib/room";
import { currentVisit } from "@/lib/viewer";
import { viewerAsk } from "@/app/actions/viewer";
import { Submit } from "@/components/forms";
import { AnswerView } from "@/components/answer";
import { Gate } from "./gate";
import { QuestionForm, RequestForm } from "./forms";
import { plural } from "@/lib/text";
import { Shell, Closed } from "./shell";

export const metadata = { title: "Data room", robots: { index: false } };

export default async function ViewerRoom({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ a?: string }> }) {
  const { slug } = await params;
  const { a } = await searchParams;
  const db = await getDb();
  const found = await personBySlug(db, slug);
  if (!found) return <Closed text="This link doesn’t open a room. Check that you have the whole link." />;
  const { person, room } = found;
  const closed = linkClosed(person);
  if (closed) return <Closed text={`${closed} Ask ${room.company} for a new one.`} />;
  const visit = await currentVisit(db, person);
  if (!visit) {
    return (
      <Shell company={room.company}>
        <div className="auth" style={{ margin: "24px auto" }}>
          <h1 className="room-title">{room.company}</h1>
          <p className="muted" style={{ margin: "6px 0 18px" }}>{room.name}. {person.kind === "person" ? `Shared with ${person.name}.` : "Shared by link."}</p>
          <Gate slug={slug} askEmail={person.askEmail} password={Boolean(person.passwordHash)} nda={person.requireNda} ndaText={room.ndaText} anyone={person.kind === "anyone"} email={person.email} />
        </div>
      </Shell>
    );
  }
  const docs = await visibleDocs(db, room.id, person.id);
  const folders = await db.select().from(schema.folders).where(eq(schema.folders.roomId, room.id)).orderBy(asc(schema.folders.position));
  const [ask] = a ? await db.select().from(schema.asks).where(and(eq(schema.asks.id, a), eq(schema.asks.personId, person.id))) : [];
  const answers = await db.select().from(schema.questions).where(and(eq(schema.questions.personId, person.id), eq(schema.questions.visitId, visit.id))).orderBy(desc(schema.questions.createdAt));
  const mine = await db.select().from(schema.questions).where(eq(schema.questions.personId, person.id)).orderBy(desc(schema.questions.createdAt));
  const visibleQuestions = person.kind === "anyone" ? answers : mine;
  const grouped = folders.map((f) => ({ f, docs: docs.filter((d) => d.folderId === f.id) })).filter((g) => g.docs.length);
  return (
    <Shell company={room.company} who={visit.email || visit.name}>
      <div>
        <h1 className="room-title">{room.company}</h1>
        <p className="muted" style={{ marginTop: 6 }}>{room.name} · {plural(docs.length, "file")}</p>
      </div>
      {person.canAsk && (
        <form action={viewerAsk} className="askbox">
          <input type="hidden" name="slug" value={slug} />
          <label className="sr-only" htmlFor="q">Search or ask</label>
          <input id="q" className="input grow" name="q" defaultValue={ask?.query} placeholder="Search or ask, like “what is the runway?”" required />
          <Submit pending="Reading…">Ask</Submit>
        </form>
      )}
      {ask && (
        <div className="card">
          <AnswerView text={ask.answer} sources={ask.sources} mode={ask.mode} hrefFor={(s) => `/r/${slug}/d/${s.documentId}#p${s.page}`} />
        </div>
      )}
      {grouped.length === 0 ? (
        <div className="card"><p>There are no files for you here yet. The owner may still be adding them.</p></div>
      ) : (
        grouped.map(({ f, docs }) => (
          <div key={f.id} className="stack" style={{ ["--gap" as string]: "8px" }}>
            <h2 className="section-label">{f.name}</h2>
            <div className="card card-flush"><ul className="list">
              {docs.map((d) => (
                <li key={d.id}><Link className="item grow" href={`/r/${slug}/d/${d.id}`}><p className="title">{d.title}</p><p className="meta">{plural(d.pageCount, "page")}</p></Link></li>
              ))}
            </ul></div>
          </div>
        ))
      )}
      {visibleQuestions.length > 0 && (
        <div className="stack" style={{ ["--gap" as string]: "8px" }}>
          <h2 className="section-label">Your questions</h2>
          <div className="card card-flush"><ul className="list">
            {visibleQuestions.map((q) => (
              <li key={q.id} style={{ alignItems: "flex-start" }}><div className="grow"><p className="title">{q.text}</p><p className="meta" style={{ color: q.answer ? "var(--text)" : undefined }}>{q.answer ?? "Waiting for the owner’s reply."}</p></div></li>
            ))}
          </ul></div>
        </div>
      )}
      {person.canAsk && (
        <div className="card stack" style={{ ["--gap" as string]: "18px" }}>
          <QuestionForm slug={slug} />
          <RequestForm slug={slug} />
        </div>
      )}
    </Shell>
  );
}
