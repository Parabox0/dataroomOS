"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { personBySlug, linkClosed } from "@/lib/room";
import { currentVisit, startVisit } from "@/lib/viewer";
import { checkPassword } from "@/lib/crypto";
import { answer, draftReply } from "@/lib/answer";
import { newId } from "@/lib/ids";
import type { FormState } from "./auth";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function load(slug: string) {
  const db = await getDb();
  const found = await personBySlug(db, slug);
  if (!found || linkClosed(found.person)) redirect(`/r/${slug}`);
  return { db, ...found };
}

export async function enterRoom(_: FormState, fd: FormData): Promise<FormState> {
  const slug = s(fd, "slug");
  const { db, person } = await load(slug);
  let email = s(fd, "email").toLowerCase();
  if (person.askEmail) {
    if (!z.string().email().safeParse(email).success) return { error: "Enter your email to open the room." };
    if (person.kind === "person" && person.email && email !== person.email.toLowerCase()) {
      return { error: "This link was shared with a different email. Ask the owner for your own link." };
    }
  } else email = "";
  if (person.passwordHash && !checkPassword(s(fd, "password"), person.passwordHash)) return { error: "That password isn't right." };
  if (person.requireNda && fd.get("nda") !== "on") return { error: "Agree to the confidentiality terms to continue." };
  await startVisit(db, person, { email: email || null, name: person.kind === "person" ? person.name : s(fd, "name").slice(0, 80) || null, nda: person.requireNda });
  redirect(`/r/${slug}`);
}

async function visitFor(slug: string) {
  const ctx = await load(slug);
  const visit = await currentVisit(ctx.db, ctx.person);
  if (!visit) redirect(`/r/${slug}`);
  return { ...ctx, visit };
}

export async function viewerAsk(fd: FormData) {
  const slug = s(fd, "slug");
  const { db, person, room, visit } = await visitFor(slug);
  const query = s(fd, "q").slice(0, 500);
  if (!query || !person.canAsk) redirect(`/r/${slug}`);
  const r = await answer(db, room.id, person.id, query);
  const id = newId();
  await db.insert(schema.asks).values({ id, roomId: room.id, personId: person.id, visitId: visit.id, query, answer: r.answer, sources: r.sources, mode: r.mode });
  redirect(`/r/${slug}?a=${id}`);
}

export async function viewerQuestion(_: FormState, fd: FormData): Promise<FormState> {
  const slug = s(fd, "slug");
  const { db, person, room, visit } = await visitFor(slug);
  const text = s(fd, "text").slice(0, 1000);
  if (!text) return { error: "Write your question first." };
  const d = await draftReply(db, room.id, text);
  await db.insert(schema.questions).values({ id: newId(), roomId: room.id, personId: person.id, visitId: visit.id, askerName: visit.name || visit.email || person.name, text, draft: d.draft, draftSources: d.sources });
  revalidatePath(`/r/${slug}`);
  return { ok: "Sent. The answer will show here once the owner replies." };
}

export async function viewerRequest(_: FormState, fd: FormData): Promise<FormState> {
  const slug = s(fd, "slug");
  const { db, person, room, visit } = await visitFor(slug);
  const title = s(fd, "title").slice(0, 120);
  if (!title) return { error: "Say which file you'd like." };
  const [m] = await db.select({ m: max(schema.checklistItems.position) }).from(schema.checklistItems).where(eq(schema.checklistItems.roomId, room.id));
  await db.insert(schema.checklistItems).values({ id: newId(), roomId: room.id, title, detail: `Asked for by ${visit.name || visit.email || person.name}.`, source: "request", personId: person.id, position: (m?.m ?? 0) + 1 });
  return { ok: "Asked. It's on the owner's checklist now." };
}
