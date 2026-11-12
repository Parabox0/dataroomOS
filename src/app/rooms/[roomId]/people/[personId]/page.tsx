import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { requireRoom } from "@/lib/auth";
import { schema } from "@/lib/db";
import { roomInsights } from "@/lib/people";
import { toggleAccess, setRule, deletePerson } from "@/app/actions/room";
import { SwitchForm } from "@/components/toggles";
import { Submit } from "@/components/forms";
import { CopyLink } from "@/components/copy";
import { LinkDetails } from "./link-form";
import { minutes } from "@/lib/text";
import { ensureHandle, publicPerson, roomAddress } from "@/lib/handle";

export const metadata = { title: "Person" };

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function PersonPage({ params, searchParams }: { params: Promise<{ roomId: string; personId: string }>; searchParams: Promise<{ added?: string }> }) {
  const { roomId, personId } = await params;
  const added = (await searchParams).added === "1";
  const { room, db } = await requireRoom(roomId);
  const [p] = await db.select().from(schema.people).where(and(eq(schema.people.id, personId), eq(schema.people.roomId, room.id)));
  if (!p) notFound();
  const folders = await db.select().from(schema.folders).where(eq(schema.folders.roomId, room.id)).orderBy(asc(schema.folders.position));
  const access = new Set((await db.select().from(schema.access).where(eq(schema.access.personId, p.id))).map((a) => a.folderId));
  const insight = (await roomInsights(db, room.id)).get(p.id)!;
  const visits = await db.select().from(schema.visits).where(eq(schema.visits.personId, p.id)).orderBy(desc(schema.visits.startedAt));
  const time = visits.length ? await db.select().from(schema.pageTime).where(inArray(schema.pageTime.visitId, visits.map((v) => v.id))) : [];
  const asks = await db.select().from(schema.asks).where(eq(schema.asks.personId, p.id)).orderBy(desc(schema.asks.createdAt));
  const docs = await db.select({ id: schema.documents.id, title: schema.documents.title }).from(schema.documents).where(eq(schema.documents.roomId, room.id));
  const titles = new Map(docs.map((d) => [d.id, d.title]));
  const base = `/rooms/${room.id}`;
  const isPublic = p.kind === "anyone" && !p.revoked && (await publicPerson(db, room.id))?.id === p.id;
  const handle = isPublic ? await ensureHandle(db, room) : null;
  const path = handle ? `/${handle}` : `/r/${p.slug}`;
  const address = handle ? await roomAddress(handle) : null;
  const hidden = { roomId: room.id, personId: p.id };
  const rules: [keyof typeof p, string][] = [
    ["askEmail", "Ask for their email before the room opens"],
    ["requireNda", "Ask them to agree to your confidentiality terms"],
    ["watermark", "Put their email and the date on every page"],
    ["allowDownload", "Let them download files"],
    ["canAsk", "Let them search and ask questions"],
  ];

  return (
    <>
      <div>
        <p className="meta"><Link href={`${base}/people`}>People</Link></p>
        <div className="row" style={{ marginTop: 2 }}>{insight.leaningIn && <span className="dot" aria-label="Leaning in" />}<h1>{p.name}</h1></div>
        <p className="muted" style={{ marginTop: 4 }}>{[p.company, p.email].filter(Boolean).join(" · ") || (p.kind === "anyone" ? "One link for anyone who has it" : "")}</p>
      </div>

      <div className="card stack" style={{ ["--gap" as string]: "10px" }}>
        <div className="row between wrap">
          <div className="grow"><h2>{p.revoked ? "Link is off" : address ? "Room address" : "Their link"}</h2><p className={address ? "address" : "meta"} style={{ wordBreak: "break-all" }}>{address ? address.label : `/r/${p.slug}`}</p></div>
          {!p.revoked && <CopyLink path={path} />}
          {!p.revoked && <Link className="btn btn-sm btn-light" href={path} target="_blank">Open as them</Link>}
        </div>
        {added && <p className="muted small" role="status">Link made. Copy it and send it yourself. Nothing was emailed.</p>}
      </div>

      <div className="card stack" style={{ ["--gap" as string]: "6px" }}>
        <h2>What they did</h2>
        <p>{insight.sentence}</p>
        {insight.topDocs.length > 0 && (
          <ul className="list" style={{ margin: "6px -20px 0" }}>
            {insight.topDocs.map((d) => (
              <li key={d.documentId} className="between"><Link className="grow" href={`${base}/documents/${d.documentId}`}>{d.title}</Link><span className="meta">{minutes(d.seconds)}, most on page {d.topPage}</span></li>
            ))}
          </ul>
        )}
      </div>

      <div className="card card-flush">
        <div style={{ padding: "18px 20px 6px" }}><h2>Can see</h2><p className="meta" style={{ marginTop: 4 }}>One switch per folder. Ask follows the same switches.</p></div>
        <ul className="list">
          {folders.map((f) => (
            <li key={f.id} className="between"><span className="grow">{f.name}</span><SwitchForm action={toggleAccess} hidden={{ ...hidden, folderId: f.id }} on={access.has(f.id)} label={`${p.name} can see ${f.name}`} /></li>
          ))}
        </ul>
      </div>

      <div className="card card-flush">
        <div style={{ padding: "18px 20px 6px" }}><h2>Link rules</h2></div>
        <ul className="list">
          {rules.map(([k, label]) => (
            <li key={k} className="between"><span className="grow">{label}</span><SwitchForm action={setRule} hidden={{ ...hidden, rule: k }} on={Boolean(p[k])} label={label} /></li>
          ))}
        </ul>
        <div style={{ padding: "8px 20px 20px" }}>
          <LinkDetails roomId={room.id} personId={p.id} hasPassword={Boolean(p.passwordHash)} expires={p.expiresAt ? p.expiresAt.toISOString().slice(0, 10) : ""} />
        </div>
      </div>

      {(visits.length > 0 || asks.length > 0) && (
        <div className="stack" style={{ ["--gap" as string]: "8px" }}>
          <h2>Visits</h2>
          <div className="card card-flush"><ul className="list">
            {visits.map((v) => {
              const t = time.filter((x) => x.visitId === v.id);
              const total = t.reduce((a, x) => a + x.seconds, 0);
              const files = [...new Set(t.map((x) => titles.get(x.documentId)).filter(Boolean))];
              return (
                <li key={v.id} style={{ alignItems: "flex-start" }}>
                  <div className="grow">
                    <p className="title">{when(v.startedAt)}{p.kind === "anyone" && (v.name || v.email) ? `, ${v.name || v.email}` : ""}</p>
                    <p className="meta">{total ? `${minutes(total)} reading ${files.join(", ")}` : "Opened the room"}{v.ndaAcceptedAt ? " · agreed to your terms" : ""}</p>
                  </div>
                </li>
              );
            })}
            {asks.map((a) => (
              <li key={a.id}><div className="grow"><p className="title">Asked “{a.query}”</p><p className="meta">{when(a.createdAt)}</p></div></li>
            ))}
          </ul></div>
        </div>
      )}

      <div className="row wrap" style={{ gap: 16 }}>
        <form action={setRule}>
          <input type="hidden" name="roomId" value={room.id} /><input type="hidden" name="personId" value={p.id} /><input type="hidden" name="rule" value="revoked" /><input type="hidden" name="on" value={p.revoked ? "0" : "1"} />
          <Submit className={p.revoked ? "btn btn-sm" : "btn-quiet btn-danger"}>{p.revoked ? "Turn the link back on" : "Turn the link off"}</Submit>
        </form>
        <form action={deletePerson}>
          <input type="hidden" name="roomId" value={room.id} /><input type="hidden" name="personId" value={p.id} />
          <Submit className="btn-quiet btn-danger">Remove {p.kind === "anyone" ? "this link" : p.name.split(" ")[0]} and their history</Submit>
        </form>
      </div>
    </>
  );
}
