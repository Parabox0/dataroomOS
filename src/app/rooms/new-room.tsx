"use client";
import { useActionState } from "react";
import { createRoom } from "@/app/actions/room";
import { Submit, Notice } from "@/components/forms";

export function NewRoomForm() {
  const [state, action] = useActionState(createRoom, undefined);
  return (
    <form action={action} className="card stack" style={{ ["--gap" as string]: "16px" }}>
      <div>
        <h2>New room</h2>
        <p className="meta" style={{ marginTop: 4 }}>It starts with the checklist investors or buyers usually expect.</p>
      </div>
      <div className="fields-2">
        <label className="field"><span>Company</span><input className="input" name="company" placeholder="Your company’s name" required /></label>
        <label className="field"><span>Room name</span><input className="input" name="name" placeholder="Seed round" /></label>
      </div>
      <fieldset className="choice">
        <legend>What is it for?</legend>
        <label><input type="radio" name="purpose" value="raise" defaultChecked /> Raising a round</label>
        <label><input type="radio" name="purpose" value="sell" /> Selling the business</label>
      </fieldset>
      <Notice state={state} />
      <div><Submit pending="Creating…">Create room</Submit></div>
    </form>
  );
}
