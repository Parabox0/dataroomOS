"use client";
import { useActionState } from "react";
import { viewerQuestion, viewerRequest } from "@/app/actions/viewer";
import { Submit, Notice } from "@/components/forms";

export function QuestionForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(viewerQuestion, undefined);
  return (
    <form action={action} className="stack on-card" style={{ ["--gap" as string]: "10px" }}>
      <input type="hidden" name="slug" value={slug} />
      <label className="field"><span>Ask the owner</span><textarea className="textarea" name="text" rows={3} placeholder="Anything the files don’t answer" required /></label>
      <Notice state={state} />
      <div><Submit className="btn btn-sm" pending="Sending…">Send question</Submit></div>
    </form>
  );
}

export function RequestForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(viewerRequest, undefined);
  return (
    <form action={action} className="stack on-card" style={{ ["--gap" as string]: "10px" }}>
      <input type="hidden" name="slug" value={slug} />
      <label className="field"><span>Request a file</span><input className="input" name="title" placeholder="For example: signed SAFE agreements" required /></label>
      <Notice state={state} />
      <div><Submit className="btn btn-sm btn-light" pending="Sending…">Request</Submit></div>
    </form>
  );
}
