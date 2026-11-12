"use client";
import { useActionState } from "react";
import { uploadFiles, uploadVersion } from "@/app/actions/room";
import { Submit, Notice } from "@/components/forms";

export function UploadForm({ roomId, folders, folderId }: { roomId: string; folders: { id: string; name: string }[]; folderId?: string }) {
  const [state, action] = useActionState(uploadFiles, undefined);
  return (
    <form action={action} className="stack" style={{ ["--gap" as string]: "14px" }} id="add">
      <input type="hidden" name="roomId" value={roomId} />
      <div>
        <h2>Add files</h2>
        <p className="meta">PDFs up to 40 MB each. Each file is read page by page, and personal details like emails, phone numbers and ID numbers are hidden for viewers. Sort for me reads each file and puts it in the right folder.</p>
      </div>
      <div className="fields-upload">
        <label className="field"><span>Files</span><input className="input" type="file" name="files" accept="application/pdf,.pdf" multiple required /></label>
        <label className="field">
          <span>Folder</span>
          <select className="input" name="folderId" defaultValue={folderId ?? (folders.length ? "auto" : "")}>
            {folders.length > 0 && <option value="auto">Sort for me</option>}
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            <option value="">No folder (only you can see it)</option>
          </select>
        </label>
        <Submit pending="Reading pages…">Add file</Submit>
      </div>
      <Notice state={state} />
    </form>
  );
}

export function VersionForm({ roomId, documentId, version }: { roomId: string; documentId: string; version: number }) {
  const [state, action] = useActionState(uploadVersion, undefined);
  return (
    <form action={action} className="stack on-card" style={{ ["--gap" as string]: "10px" }}>
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="documentId" value={documentId} />
      <label className="field"><span>Replace with a new version (now on version {version})</span><input className="input" type="file" name="file" accept="application/pdf,.pdf" required /></label>
      <Notice state={state} />
      <div><Submit className="btn btn-sm" pending="Reading pages…">Upload new version</Submit></div>
    </form>
  );
}
