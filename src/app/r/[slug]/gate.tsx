"use client";
import { useActionState } from "react";
import { enterRoom } from "@/app/actions/viewer";
import { Submit, Notice } from "@/components/forms";

export function Gate({ slug, askEmail, password, nda, ndaText, anyone, email }: { slug: string; askEmail: boolean; password: boolean; nda: boolean; ndaText: string | null; anyone: boolean; email?: string | null }) {
  const [state, action] = useActionState(enterRoom, undefined);
  return (
    <form action={action} className="card stack on-card" style={{ ["--gap" as string]: "14px" }}>
      <input type="hidden" name="slug" value={slug} />
      {anyone && <label className="field"><span>Your name</span><input className="input" name="name" autoComplete="name" /></label>}
      {askEmail && <label className="field"><span>Your email</span><input className="input" type="email" name="email" autoComplete="email" defaultValue={email ?? ""} required /></label>}
      {password && <label className="field"><span>Password</span><input className="input" type="password" name="password" required /></label>}
      {nda && (
        <div className="stack" style={{ ["--gap" as string]: "8px" }}>
          <div className="note" style={{ maxHeight: 180, overflowY: "auto", whiteSpace: "pre-wrap" }}>{ndaText || "Keep what you read here confidential."}</div>
          <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="nda" required /> I agree to these terms</label>
        </div>
      )}
      <Notice state={state} />
      <Submit pending="Opening…">Open the room</Submit>
      {askEmail && <p className="meta">The owner sees your email and which pages you read, and each page carries your email as a watermark.</p>}
    </form>
  );
}
