"use client";
import { useActionState } from "react";
import { updateRoom } from "@/app/actions/room";
import { Submit, Notice } from "@/components/forms";

export function RoomForm({ room }: { room: { id: string; company: string; name: string; ndaText: string | null; handle: string; host: string } }) {
  const [state, action] = useActionState(updateRoom, undefined);
  return (
    <form action={action} className="card stack on-card" style={{ ["--gap" as string]: "14px" }}>
      <input type="hidden" name="roomId" value={room.id} />
      <label className="field"><span>Company</span><input className="input" name="company" defaultValue={room.company} required /></label>
      <label className="field"><span>Room name</span><input className="input" name="name" defaultValue={room.name} /></label>
      <label className="field">
        <span>Room address</span>
        <div className="prefixed"><span>{room.host}/</span><input className="input" name="handle" defaultValue={room.handle} required pattern="[a-z0-9][a-z0-9-]*[a-z0-9]" title="Lowercase letters, numbers and dashes" /></div>
      </label>
      <label className="field"><span>Confidentiality terms viewers agree to</span><textarea className="textarea" name="ndaText" rows={6} defaultValue={room.ndaText ?? ""} placeholder="Shown before the room opens for anyone whose link asks them to agree." /></label>
      <Notice state={state} />
      <div><Submit>Save</Submit></div>
    </form>
  );
}
