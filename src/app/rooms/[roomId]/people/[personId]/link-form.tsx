"use client";
import { useActionState } from "react";
import { setLinkDetails } from "@/app/actions/room";
import { Submit, Notice } from "@/components/forms";

export function LinkDetails({ roomId, personId, expires, hasPassword }: { roomId: string; personId: string; expires: string; hasPassword: boolean }) {
  const [state, action] = useActionState(setLinkDetails, undefined);
  return (
    <form action={action} className="stack on-card" style={{ ["--gap" as string]: "12px" }}>
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="personId" value={personId} />
      <div className="row wrap" style={{ alignItems: "flex-start" }}>
        <label className="field grow"><span>Link stops working after</span><input className="input" type="date" name="expiresAt" defaultValue={expires} /></label>
        <label className="field grow"><span>{hasPassword ? "Change link password" : "Link password (optional)"}</span><input className="input" type="password" name="password" autoComplete="new-password" placeholder={hasPassword ? "Password is set" : "No password"} /></label>
      </div>
      {hasPassword && <label className="row small" style={{ gap: 6 }}><input type="checkbox" name="clearPassword" value="1" /> Remove the password</label>}
      <Notice state={state} />
      <div><Submit className="btn btn-sm">Save</Submit></div>
    </form>
  );
}
