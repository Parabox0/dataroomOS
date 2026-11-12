import { requireRoom } from "@/lib/auth";
import { deleteRoom } from "@/app/actions/room";
import { Submit } from "@/components/forms";
import { RoomForm } from "./form";
import { ensureHandle, roomAddress } from "@/lib/handle";

export const metadata = { title: "Room settings" };

export default async function Settings({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { roomId } = await params;
  const { error } = await searchParams;
  const { room, db } = await requireRoom(roomId);
  const handle = await ensureHandle(db, room);
  const host = (await roomAddress(handle)).label.replace(/\/[^/]*$/, "");
  return (
    <>
      <div className="page-head"><div><h1>Room settings</h1></div></div>
      <RoomForm room={{ id: room.id, company: room.company, name: room.name, ndaText: room.ndaText, handle, host }} />
      <form action={deleteRoom} className="card stack on-card" style={{ ["--gap" as string]: "12px" }}>
        <input type="hidden" name="roomId" value={room.id} />
        <h2>Delete this room</h2>
        <p className="muted">This removes every file, page, link and reading history in the room. It can’t be undone.</p>
        <label className="field"><span>Type {room.company} to confirm</span><input className="input" name="confirm" autoComplete="off" required /></label>
        {error === "confirm" && <p className="error" role="alert">The name didn’t match, so nothing was deleted.</p>}
        <div><Submit className="btn-quiet btn-danger">Delete room</Submit></div>
      </form>
    </>
  );
}
