"use client";
import { useActionState, useState } from "react";
import { addPerson } from "@/app/actions/room";
import { Submit, Notice } from "@/components/forms";

export function AddPerson({ roomId, folders }: { roomId: string; folders: { id: string; name: string }[] }) {
  const [state, action] = useActionState(addPerson, undefined);
  const [kind, setKind] = useState<"person" | "anyone">("person");
  return (
    <form action={action} className="card stack" style={{ ["--gap" as string]: "18px" }} id="add">
      <input type="hidden" name="roomId" value={roomId} />
      <div>
        <h2>Share the room</h2>
        <p className="meta" style={{ marginTop: 4 }}>Each person gets their own link, with their own folder switches.</p>
      </div>
      <fieldset className="choice">
        <legend>Who is it for?</legend>
        <label><input type="radio" name="kind" value="person" checked={kind === "person"} onChange={() => setKind("person")} /> One person</label>
        <label><input type="radio" name="kind" value="anyone" checked={kind === "anyone"} onChange={() => setKind("anyone")} /> Anyone with the link</label>
      </fieldset>
      {kind === "person" && (
        <div className="fields-3">
          <label className="field"><span>Name</span><input className="input" name="name" required /></label>
          <label className="field"><span>Email</span><input className="input" type="email" name="email" /></label>
          <label className="field"><span>Firm</span><input className="input" name="company" /></label>
        </div>
      )}
      <fieldset className="choice">
        <legend>Can see</legend>
        {folders.map((f) => (
          <label key={f.id}><input type="checkbox" name="folders" value={f.id} defaultChecked={f.name !== "Legal"} /> {f.name}</label>
        ))}
      </fieldset>
      <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="requireNda" /> Ask them to agree to your confidentiality terms first</label>
      <Notice state={state} />
      <div className="row" style={{ gap: 14 }}><Submit pending="Making link…">Make link</Submit><p className="meta">Nothing is emailed. You get a link to send yourself.</p></div>
    </form>
  );
}
