import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireRoom } from "@/lib/auth";
import { schema } from "@/lib/db";
import { answerQuestion, redraft } from "@/app/actions/room";
import { Submit } from "@/components/forms";
import { AnswerView } from "@/components/answer";

export const metadata = { title: "Questions" };

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function Questions({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ view?: string }> }) {
  const { roomId } = await params;
  const answered = (await searchParams).view === "answered";
  const { room, db } = await requireRoom(roomId);
  const rows = await db
    .select({ q: schema.questions, person: schema.people })
    .from(schema.questions)
    .innerJoin(schema.people, eq(schema.people.id, schema.questions.personId))
    .where(and(eq(schema.questions.roomId, room.id), eq(schema.questions.status, answered ? "answered" : "open")))
    .orderBy(desc(schema.questions.createdAt));
  const base = `/rooms/${room.id}`;
  return (
    <>
      <div className="page-head"><div>
        <h1>{answered ? "Answered questions" : "Open questions"}</h1>
        <p className="muted" style={{ marginTop: 6 }}>{answered ? "Viewers see your reply in the room the next time they open it." : "Questions viewers sent you. Each has a reply drafted from your files. Edit it, then send."}</p>
      </div></div>
      {rows.length === 0 && <div className="card"><p>{answered ? "No answered questions yet." : "No open questions. You’re all caught up."}</p></div>}
      {rows.map(({ q, person }) => (
        <div key={q.id} className="card stack" style={{ ["--gap" as string]: "12px" }}>
          <div>
            <p className="meta"><Link href={`${base}/people/${person.id}`}>{q.askerName || person.name}{person.company ? `, ${person.company}` : ""}</Link> · {when(q.createdAt)}</p>
            <p style={{ fontSize: 17, fontWeight: 500, marginTop: 4 }}>{q.text}</p>
          </div>
          {answered ? (
            <p>{q.answer}</p>
          ) : (
            <>
              {q.draftSources.length > 0 && (
                <div className="note"><AnswerView text={q.draft ?? ""} sources={q.draftSources} mode="draft" hrefFor={(s) => `${base}/documents/${s.documentId}#p${s.page}`} /></div>
              )}
              <form action={answerQuestion} className="stack on-card" style={{ ["--gap" as string]: "10px" }}>
                <input type="hidden" name="roomId" value={room.id} /><input type="hidden" name="questionId" value={q.id} />
                <label className="field"><span>Your reply</span><textarea className="textarea" name="answer" defaultValue={(q.draft ?? "").replace(/\s*\[\d+\]/g, "")} required /></label>
                <div className="row wrap">
                  <Submit pending="Sending…">Send reply</Submit>
                  <Submit className="btn-quiet" formAction={redraft} formNoValidate>Draft again</Submit>
                </div>
              </form>
            </>
          )}
        </div>
      ))}
    </>
  );
}
