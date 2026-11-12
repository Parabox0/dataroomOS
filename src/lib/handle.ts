import { and, desc, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { schema, type DB as Db } from "@/lib/db";

/** Words the site already uses for its own pages, so no room can take them. */
const RESERVED = new Set([
  "r", "rooms", "api", "sign-in", "sign-up", "pricing", "security", "privacy", "terms", "about", "blog", "help", "docs",
  "admin", "app", "login", "logout", "signup", "signin", "settings", "account", "fonts", "static", "assets", "_next",
  "favicon.ico", "robots.txt", "sitemap.xml", "www", "mail", "support", "status",
]);

/** "Brightloaf, Inc." becomes "brightloaf-inc". Letters, numbers and single dashes only. */
export function toHandle(text: string): string {
  return text
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40).replace(/-+$/g, "");
}

/** Why a handle can't be used, or null when it can. */
export function handleProblem(handle: string): string | null {
  if (handle.length < 2) return "Use at least 2 letters or numbers.";
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(handle)) return "Use lowercase letters, numbers and dashes.";
  if (RESERVED.has(handle)) return "That address is used by the site itself. Try another.";
  return null;
}

/** The first free handle built from the company name: brightloaf, then brightloaf-2, and so on. */
export async function freeHandle(db: Db, company: string, exceptRoomId?: string): Promise<string> {
  let base = toHandle(company);
  if (handleProblem(base)) base = base.length >= 2 ? `${base}-room` : "room";
  for (let n = 1; n < 500; n++) {
    const h = n === 1 ? base : `${base}-${n}`;
    if (handleProblem(h)) continue;
    const taken = await db.select({ id: schema.rooms.id }).from(schema.rooms)
      .where(exceptRoomId ? and(eq(schema.rooms.handle, h), ne(schema.rooms.id, exceptRoomId)) : eq(schema.rooms.handle, h)).limit(1);
    if (!taken.length) return h;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Gives a room its handle the first time anyone needs it, for rooms made before handles existed. */
export async function ensureHandle(db: Db, room: { id: string; company: string; handle: string | null }): Promise<string> {
  if (room.handle) return room.handle;
  const h = await freeHandle(db, room.company, room.id);
  await db.update(schema.rooms).set({ handle: h }).where(eq(schema.rooms.id, room.id));
  return h;
}

/** The room's open link: the newest "Anyone with the link" share that is still on. */
export async function publicPerson(db: Db, roomId: string) {
  const rows = await db.select().from(schema.people)
    .where(and(eq(schema.people.roomId, roomId), eq(schema.people.kind, "anyone"), eq(schema.people.revoked, false)))
    .orderBy(desc(schema.people.createdAt)).limit(1);
  return rows[0] ?? null;
}

/** The address people see and copy: this site's host, a slash and the handle. Uses the host the page was opened on, so it is right on any domain. */
export async function roomAddress(handle: string): Promise<{ href: string; label: string }> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") || "https").split(",")[0].trim();
  if (!host) return { href: `/${handle}`, label: `/${handle}` };
  return { href: `${proto}://${host}/${handle}`, label: `${host}/${handle}` };
}
