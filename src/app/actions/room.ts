"use server";
import { ensureHandle, freeHandle, handleProblem, publicPerson, toHandle } from "@/lib/handle";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { requireRoom, requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { newId, newSlug } from "@/lib/ids";
import { hashPassword } from "@/lib/crypto";
import { templateFor } from "@/lib/checklists";
import { addDocument, newVersion } from "@/lib/ingest";
import { answer, draftReply } from "@/lib/answer";
import { checkRoom } from "@/lib/check-room";
import { deleteFolder as deleteFiles } from "@/lib/storage";
import type { FormState } from "./auth";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (roomId: string) => revalidatePath(`/rooms/${roomId}`, "layout");

// Rooms

export async function createRoom(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const company = s(fd, "company");
  const name = s(fd, "name") || "Data room";
  const purpose = s(fd, "purpose") === "sell" ? "sell" : "raise";
  if (!company) return { error: "Add the company's name." };
  const db = await getDb();
  const id = newId();
  await db.insert(schema.rooms).values({ id, ownerId: user.id, company: company.slice(0, 80), name: name.slice(0, 80), purpose, handle: await freeHandle(db, company) });
  const tpl = templateFor(purpose);
  const folders = [...new Set(tpl.map((t) => t.folder))];
  await db.insert(schema.folders).values(folders.map((f, i) => ({ id: newId(), roomId: id, name: f, position: i })));
  await db.insert(schema.checklistItems).values(tpl.map((t, i) => ({ id: newId(), roomId: id, title: t.title, detail: t.detail, source: "expected", match: t.match, position: i })));
  redirect(`/rooms/${id}`);
}

export async function updateRoom(_: FormState, fd: FormData): Promise<FormState> {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const company = s(fd, "company");
  if (!company) return { error: "The company name can't be empty." };
  let handle = room.handle;
  if (fd.has("handle")) {
    const wanted = toHandle(s(fd, "handle"));
    const problem = handleProblem(wanted);
    if (problem) return { error: `Room address: ${problem}` };
    if (wanted !== room.handle) {
      const [taken] = await db.select({ id: schema.rooms.id }).from(schema.rooms).where(eq(schema.rooms.handle, wanted)).limit(1);
      if (taken) return { error: "Another room already has that address. Try adding a word or a number." };
      handle = wanted;
    }
  }
  await db.update(schema.rooms).set({ company: company.slice(0, 80), name: (s(fd, "name") || room.name).slice(0, 80), ndaText: s(fd, "ndaText").slice(0, 6000) || null, handle }).where(eq(schema.rooms.id, room.id));
  back(room.id);
  return { ok: "Saved." };
}

export async function deleteRoom(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  if (s(fd, "confirm") !== room.company) redirect(`/rooms/${room.id}/settings?error=confirm`);
  await db.delete(schema.rooms).where(eq(schema.rooms.id, room.id));
  await deleteFiles(`rooms/${room.id}`);
  redirect("/rooms");
}

// Folders and files

export async function addFolder(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const name = s(fd, "name").slice(0, 60);
  if (!name) return;
  const [m] = await db.select({ m: max(schema.folders.position) }).from(schema.folders).where(eq(schema.folders.roomId, room.id));
  await db.insert(schema.folders).values({ id: newId(), roomId: room.id, name, position: (m?.m ?? 0) + 1 });
  back(room.id);
}

export async function deleteFolderAction(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  await db.delete(schema.folders).where(and(eq(schema.folders.id, s(fd, "folderId")), eq(schema.folders.roomId, room.id)));
  back(room.id);
  redirect(`/rooms/${room.id}/documents`);
}

export async function uploadFiles(_: FormState, fd: FormData): Promise<FormState> {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const sort = s(fd, "folderId") === "auto";
  const folderId = sort ? null : s(fd, "folderId") || null;
  if (folderId) {
    const [f] = await db.select().from(schema.folders).where(and(eq(schema.folders.id, folderId), eq(schema.folders.roomId, room.id)));
    if (!f) return { error: "That folder no longer exists." };
  }
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Choose at least one PDF." };
  const added: string[] = [];
  const failed: string[] = [];
  const placed: string[] = [];
  const folders = sort ? await db.select().from(schema.folders).where(eq(schema.folders.roomId, room.id)) : [];
  for (const file of files) {
    try {
      const id = await addDocument(db, { roomId: room.id, folderId, sort, fileName: file.name, data: new Uint8Array(await file.arrayBuffer()) });
      added.push(file.name);
      if (sort) {
        const [d] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
        const [item] = await db.select().from(schema.checklistItems).where(eq(schema.checklistItems.documentId, id));
        const where = folders.find((f) => f.id === d?.folderId)?.name;
        placed.push(`${d?.title ?? file.name} went to ${where ?? "no folder, so only you can see it"}${item ? ` and ticked “${item.title}”` : ""}.`);
      }
    } catch (e) {
      failed.push(`${file.name}: ${(e as Error).message}`);
    }
  }
  back(room.id);
  if (failed.length) return { error: `${added.length ? `Added ${added.length}. ` : ""}Couldn't add ${failed.join("; ")}` };
  if (placed.length) return { ok: placed.join(" ") };
  return { ok: added.length === 1 ? `Added ${added[0]}.` : `Added ${added.length} files.` };
}

async function ownDoc(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const [doc] = await db.select().from(schema.documents).where(and(eq(schema.documents.id, s(fd, "documentId")), eq(schema.documents.roomId, room.id)));
  if (!doc) redirect(`/rooms/${room.id}/documents`);
  return { room, db, doc };
}

export async function updateDoc(fd: FormData) {
  const { room, db, doc } = await ownDoc(fd);
  const title = s(fd, "title").slice(0, 120) || doc.title;
  const folderId = s(fd, "folderId") || null;
  if (folderId) {
    const [f] = await db.select().from(schema.folders).where(and(eq(schema.folders.id, folderId), eq(schema.folders.roomId, room.id)));
    if (!f) return;
  }
  await db.update(schema.documents).set({ title, folderId, updatedAt: new Date() }).where(eq(schema.documents.id, doc.id));
  back(room.id);
}

export async function uploadVersion(_: FormState, fd: FormData): Promise<FormState> {
  const { room, db, doc } = await ownDoc(fd);
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a PDF." };
  try {
    await newVersion(db, doc.id, file.name, new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return { error: (e as Error).message };
  }
  back(room.id);
  return { ok: `Version ${doc.version + 1} is live. Everyone's links now show it.` };
}

export async function deleteDoc(fd: FormData) {
  const { room, db, doc } = await ownDoc(fd);
  await db.delete(schema.documents).where(eq(schema.documents.id, doc.id));
  await deleteFiles(`rooms/${room.id}/${doc.id}`);
  back(room.id);
  redirect(`/rooms/${room.id}/documents`);
}

export async function setHidden(fd: FormData) {
  const { room, db, doc } = await ownDoc(fd);
  const hidden = s(fd, "hidden") === "1";
  const id = s(fd, "itemId");
  const where = id === "all" ? eq(schema.sensitiveItems.documentId, doc.id) : and(eq(schema.sensitiveItems.id, id), eq(schema.sensitiveItems.documentId, doc.id));
  await db.update(schema.sensitiveItems).set({ hidden }).where(where);
  back(room.id);
}

// Checklist

export async function addChecklistItem(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const title = s(fd, "title").slice(0, 120);
  if (!title) return;
  const [m] = await db.select({ m: max(schema.checklistItems.position) }).from(schema.checklistItems).where(eq(schema.checklistItems.roomId, room.id));
  await db.insert(schema.checklistItems).values({ id: newId(), roomId: room.id, title, source: "own", position: (m?.m ?? 0) + 1 });
  back(room.id);
}

export async function toggleChecklistItem(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  await db.update(schema.checklistItems).set({ status: s(fd, "status") === "done" ? "done" : "todo" }).where(and(eq(schema.checklistItems.id, s(fd, "itemId")), eq(schema.checklistItems.roomId, room.id)));
  back(room.id);
}

export async function linkChecklistItem(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const documentId = s(fd, "documentId") || null;
  await db.update(schema.checklistItems).set({ documentId, status: documentId ? "done" : "todo" }).where(and(eq(schema.checklistItems.id, s(fd, "itemId")), eq(schema.checklistItems.roomId, room.id)));
  back(room.id);
}

export async function deleteChecklistItem(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  await db.delete(schema.checklistItems).where(and(eq(schema.checklistItems.id, s(fd, "itemId")), eq(schema.checklistItems.roomId, room.id)));
  back(room.id);
}

// Ask and Check

export async function ownerAsk(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const query = s(fd, "q").slice(0, 500);
  if (!query) redirect(`/rooms/${room.id}/ask`);
  const r = await answer(db, room.id, null, query);
  const id = newId();
  await db.insert(schema.asks).values({ id, roomId: room.id, personId: null, query, answer: r.answer, sources: r.sources, mode: r.mode });
  redirect(`/rooms/${room.id}/ask?a=${id}`);
}

export async function runCheck(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  await checkRoom(db, room.id);
  back(room.id);
  redirect(`/rooms/${room.id}/check?ran=1`);
}

// Questions

export async function answerQuestion(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const text = s(fd, "answer").slice(0, 4000);
  if (!text) return;
  await db.update(schema.questions).set({ answer: text, status: "answered", answeredAt: new Date() }).where(and(eq(schema.questions.id, s(fd, "questionId")), eq(schema.questions.roomId, room.id)));
  back(room.id);
}

export async function redraft(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const [q] = await db.select().from(schema.questions).where(and(eq(schema.questions.id, s(fd, "questionId")), eq(schema.questions.roomId, room.id)));
  if (!q) return;
  const d = await draftReply(db, room.id, q.text);
  await db.update(schema.questions).set({ draft: d.draft, draftSources: d.sources }).where(eq(schema.questions.id, q.id));
  back(room.id);
}

// People

const Person = z.object({
  name: z.string().trim().max(80),
  email: z.string().trim().toLowerCase().max(200),
  company: z.string().trim().max(80),
  kind: z.enum(["person", "anyone"]),
});

export async function addPerson(_: FormState, fd: FormData): Promise<FormState> {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const p = Person.parse({ name: s(fd, "name"), email: s(fd, "email"), company: s(fd, "company"), kind: s(fd, "kind") === "anyone" ? "anyone" : "person" });
  if (p.kind === "person" && !p.name) return { error: "Add their name." };
  if (p.email && !z.string().email().safeParse(p.email).success) return { error: "That email doesn't look right." };
  const folders = fd.getAll("folders").map(String);
  const own = folders.length ? await db.select({ id: schema.folders.id }).from(schema.folders).where(and(eq(schema.folders.roomId, room.id), inArray(schema.folders.id, folders))) : [];
  const id = newId();
  await db.insert(schema.people).values({
    id,
    roomId: room.id,
    kind: p.kind,
    name: p.kind === "anyone" ? "Anyone with the link" : p.name,
    email: p.email || null,
    company: p.company || null,
    slug: newSlug(),
    requireNda: fd.get("requireNda") === "on",
  });
  if (own.length) await db.insert(schema.access).values(own.map((f) => ({ personId: id, folderId: f.id })));
  back(room.id);
  redirect(`/rooms/${room.id}/people/${id}?added=1`);
}

/** Turns on the short room address by making an open link that can see every folder except Legal. */
export async function openRoomAddress(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const existing = await publicPerson(db, room.id);
  if (existing) redirect(`/rooms/${room.id}/people/${existing.id}`);
  await ensureHandle(db, room);
  const folders = await db.select().from(schema.folders).where(eq(schema.folders.roomId, room.id));
  const id = newId();
  await db.insert(schema.people).values({ id, roomId: room.id, kind: "anyone", name: "Anyone with the link", slug: newSlug() });
  const open = folders.filter((f) => f.name.toLowerCase() !== "legal");
  if (open.length) await db.insert(schema.access).values(open.map((f) => ({ personId: id, folderId: f.id })));
  back(room.id);
  redirect(`/rooms/${room.id}/people/${id}?added=1`);
}

async function ownPerson(fd: FormData) {
  const { room, db } = await requireRoom(s(fd, "roomId"));
  const [person] = await db.select().from(schema.people).where(and(eq(schema.people.id, s(fd, "personId")), eq(schema.people.roomId, room.id)));
  if (!person) redirect(`/rooms/${room.id}/people`);
  return { room, db, person };
}

export async function toggleAccess(fd: FormData) {
  const { room, db, person } = await ownPerson(fd);
  const folderId = s(fd, "folderId");
  const [f] = await db.select().from(schema.folders).where(and(eq(schema.folders.id, folderId), eq(schema.folders.roomId, room.id)));
  if (!f) return;
  if (s(fd, "on") === "1") await db.insert(schema.access).values({ personId: person.id, folderId }).onConflictDoNothing();
  else await db.delete(schema.access).where(and(eq(schema.access.personId, person.id), eq(schema.access.folderId, folderId)));
  back(room.id);
}

const RULES = ["askEmail", "requireNda", "watermark", "allowDownload", "canAsk", "revoked"] as const;

export async function setRule(fd: FormData) {
  const { room, db, person } = await ownPerson(fd);
  const rule = s(fd, "rule") as (typeof RULES)[number];
  if (!RULES.includes(rule)) return;
  await db.update(schema.people).set({ [rule]: s(fd, "on") === "1" }).where(eq(schema.people.id, person.id));
  back(room.id);
}

export async function setLinkDetails(_: FormState, fd: FormData): Promise<FormState> {
  const { room, db, person } = await ownPerson(fd);
  const expires = s(fd, "expiresAt");
  const password = s(fd, "password");
  const update: Partial<typeof schema.people.$inferInsert> = { expiresAt: expires ? new Date(`${expires}T23:59:59`) : null };
  if (fd.get("clearPassword") === "1") update.passwordHash = null;
  else if (password) {
    if (password.length < 6) return { error: "Use at least 6 characters for the link password." };
    update.passwordHash = hashPassword(password);
  }
  await db.update(schema.people).set(update).where(eq(schema.people.id, person.id));
  back(room.id);
  return { ok: "Saved." };
}

export async function deletePerson(fd: FormData) {
  const { room, db, person } = await ownPerson(fd);
  await db.delete(schema.people).where(eq(schema.people.id, person.id));
  back(room.id);
  redirect(`/rooms/${room.id}/people`);
}
