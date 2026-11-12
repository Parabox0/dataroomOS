import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { requireRoom } from "@/lib/auth";
import { schema } from "@/lib/db";
import { roomInsights } from "@/lib/people";
import { AddPerson } from "./add-person";
import { plural } from "@/lib/text";
import { ensureHandle, publicPerson, roomAddress } from "@/lib/handle";
import { CopyLink } from "@/components/copy";
import { openRoomAddress } from "@/app/actions/room";
import { Submit } from "@/components/forms";

export const metadata = { title: "People" };

const ago = (d: Date | null) => {
  if (!d) return "Never opened";
  const h = (Date.now() - d.getTime()) / 3600_000;
  if (h < 1) return "Seen just now";
  if (h < 24) return `Seen ${Math.round(h)} h ago`;
  const days = Math.round(h / 24);
  return days === 1 ? "Seen yesterday" : `Seen ${days} days ago`;
};

export default async function People({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { room, db } = await requireRoom(roomId);
  const people = await db.select().from(schema.people).where(eq(schema.people.roomId, room.id)).orderBy(asc(schema.people.createdAt));
  const folders = await db.select().from(schema.folders).where(eq(schema.folders.roomId, room.id)).orderBy(asc(schema.folders.position));
  const access = people.length ? await db.select().from(schema.access).where(inArray(schema.access.personId, people.map((p) => p.id))) : [];
  const insights = await roomInsights(db, room.id);
  const sorted = [...people].sort((a, b) => Number(insights.get(b.id)?.leaningIn) - Number(insights.get(a.id)?.leaningIn) || (insights.get(b.id)?.seconds ?? 0) - (insights.get(a.id)?.seconds ?? 0));
  const base = `/rooms/${room.id}`;
  const handle = await ensureHandle(db, room);
  const address = await roomAddress(handle);
  const open = await publicPerson(db, room.id);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>People</h1>
          <p className="muted">Who can see the room, and what they actually read. An orange dot means someone is leaning in this week.</p>
        </div>
        <a href="#add" className="btn btn-sm">Share</a>
      </div>
      <div className="card addr-card">
        <div className="grow">
          <p className="section-label">Room address</p>
          <p className="address">{address.label}</p>
          <p className="meta">{open ? "Anyone with this address can open the room, with the folders and rules of your open link." : "Off. Turn it on to share one easy address, or give each person their own link below."}</p>
        </div>
        {open ? (
          <div className="row">
            <CopyLink path={`/${handle}`} />
            <Link className="btn btn-sm btn-light" href={`${base}/people/${open.id}`}>Settings</Link>
          </div>
        ) : (
          <form action={openRoomAddress}>
            <input type="hidden" name="roomId" value={room.id} />
            <Submit className="btn btn-sm">Turn on</Submit>
          </form>
        )}
      </div>
      {people.length === 0 ? (
        <div className="card"><p>Nobody has a link yet. Share the room below. Each person gets their own link and folder switches.</p></div>
      ) : (
        <div className="card card-flush"><ul className="list">
          {sorted.map((p) => {
            const i = insights.get(p.id)!;
            const n = access.filter((a) => a.personId === p.id).length;
            return (
              <li key={p.id} style={{ alignItems: "flex-start" }}>
                <span style={{ width: 8, marginTop: 8 }}>{i.leaningIn && <span className="dot" aria-label="Leaning in" />}</span>
                <Link href={`${base}/people/${p.id}`} className="item grow">
                  <p className="title">{p.name}{p.company ? `, ${p.company}` : ""}</p>
                  <p className="meta" style={{ color: "var(--text)" }}>{i.sentence}</p>
                  <p className="meta">{p.revoked ? "Link off" : `Can see ${plural(n, "folder")} of ${folders.length}`} · {ago(i.lastSeen)}{p.kind === "anyone" && i.visits ? ` · ${plural(i.visits, "visit")}` : ""}</p>
                </Link>
              </li>
            );
          })}
        </ul></div>
      )}
      <AddPerson roomId={room.id} folders={folders.map((f) => ({ id: f.id, name: f.name }))} />
    </>
  );
}
