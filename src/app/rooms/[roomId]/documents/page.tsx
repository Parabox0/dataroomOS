import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { requireRoom } from "@/lib/auth";
import { schema } from "@/lib/db";
import { addFolder, deleteFolderAction } from "@/app/actions/room";
import { Submit } from "@/components/forms";
import { UploadForm } from "./upload";
import { plural } from "@/lib/text";

export const metadata = { title: "Documents" };

export default async function Documents({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ folder?: string }> }) {
  const { roomId } = await params;
  const { folder } = await searchParams;
  const { room, db } = await requireRoom(roomId);
  const folders = await db.select().from(schema.folders).where(eq(schema.folders.roomId, room.id)).orderBy(asc(schema.folders.position));
  const current = folders.find((f) => f.id === folder);
  const all = await db.select().from(schema.documents).where(eq(schema.documents.roomId, room.id)).orderBy(asc(schema.documents.title));
  const docs = current ? all.filter((d) => d.folderId === current.id) : all;
  const names = new Map(folders.map((f) => [f.id, f.name]));
  const base = `/rooms/${room.id}`;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{current ? current.name : "All documents"}</h1>
          <p className="muted">{plural(docs.length, "file")}{current ? "" : ` in ${plural(folders.length, "folder")}`}</p>
        </div>
        <a href="#add" className="btn btn-sm">Add file</a>
      </div>
      {docs.length === 0 ? (
        <div className="card"><p>{current ? "This folder is empty. Add a file below." : "No files yet. Add your first PDF below. It will tick off the checklist item it fits."}</p></div>
      ) : (
        <div className="card card-flush">
          <ul className="list">
            {docs.map((d) => (
              <li key={d.id}>
                <Link href={`${base}/documents/${d.id}`} className="item grow">
                  <p className="title">{d.title}</p>
                  <p className="meta">{plural(d.pageCount, "page")}{!current ? ` · ${d.folderId ? names.get(d.folderId) : "No folder"}` : ""}{d.version > 1 ? ` · version ${d.version}` : ""}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card card-flush">
        <div className="card-sec">
          <UploadForm roomId={room.id} folders={folders.map((f) => ({ id: f.id, name: f.name }))} folderId={current?.id} />
        </div>
        <div className="card-sec card-foot">
          <form action={addFolder} className="row">
            <input type="hidden" name="roomId" value={room.id} />
            <label className="sr-only" htmlFor="folder-name">New folder name</label>
            <input id="folder-name" className="input" name="name" placeholder="New folder name" required style={{ width: 220 }} />
            <Submit className="btn btn-light">Add folder</Submit>
          </form>
          {current ? (
            <form action={deleteFolderAction} className="row" style={{ marginLeft: "auto" }}>
              <input type="hidden" name="roomId" value={room.id} />
              <input type="hidden" name="folderId" value={current.id} />
              <span className="meta hide-sm">Its files move to No folder.</span>
              <Submit className="btn-quiet btn-danger">Delete this folder</Submit>
            </form>
          ) : <span className="meta hide-sm" style={{ marginLeft: "auto" }}>Folders are what you switch on or off for each person.</span>}
        </div>
      </div>
    </>
  );
}
