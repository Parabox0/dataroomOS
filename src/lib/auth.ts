import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and, gt } from "drizzle-orm";
import { getDb, schema } from "./db";
import { newId } from "./ids";
import { clerkEnabled } from "./clerk-config";

const COOKIE = "dr_session";
const DAYS = 30;

export const secureCookies = () => process.env.NODE_ENV === "production" && process.env.DATAROOM_INSECURE_COOKIE !== "1";

export async function startSession(userId: string) {
  const db = await getDb();
  const id = newId(32);
  const expiresAt = new Date(Date.now() + DAYS * 86400_000);
  await db.insert(schema.sessions).values({ id, userId, expiresAt });
  (await cookies()).set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: secureCookies(), path: "/", expires: expiresAt });
}

export async function endSession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
  }
  jar.delete(COOKIE);
}

export type User = typeof schema.users.$inferSelect;

export async function currentUser(): Promise<User | null> {
  // 1. The app's own session: the sample room, or email and password sign-in when Clerk is off.
  const id = (await cookies()).get(COOKIE)?.value;
  if (id) {
    const db = await getDb();
    const rows = await db
      .select({ user: schema.users })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
      .where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, new Date())))
      .limit(1);
    if (rows[0]) return rows[0].user;
  }
  // 2. A Clerk sign-in, when Clerk is switched on.
  return clerkEnabled() ? clerkUser() : null;
}

/** Finds the Dataroom OS account for the person signed in to Clerk, making one the first time they arrive. */
async function clerkUser(): Promise<User | null> {
  const { auth, currentUser: clerkCurrentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return null;
  const db = await getDb();
  const [linked] = await db.select().from(schema.users).where(eq(schema.users.clerkId, userId)).limit(1);
  if (linked) return linked;

  const person = await clerkCurrentUser();
  if (!person) return null;
  const primary = person.emailAddresses.find((e) => e.id === person.primaryEmailAddressId) ?? person.emailAddresses[0];
  if (!primary) return null;
  const email = primary.emailAddress.trim().toLowerCase();
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || email.split("@")[0];

  // An older Dataroom OS account with the same email joins up with this Clerk sign-in, but only when Clerk has checked the email.
  const [sameEmail] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (sameEmail) {
    if (primary.verification?.status !== "verified" || sameEmail.clerkId) return null;
    const [joined] = await db.update(schema.users).set({ clerkId: userId }).where(eq(schema.users.id, sameEmail.id)).returning();
    return joined ?? null;
  }
  const [made] = await db
    .insert(schema.users)
    .values({ id: newId(), email, name, passwordHash: "", clerkId: userId })
    .onConflictDoNothing()
    .returning();
  if (made) return made;
  const [again] = await db.select().from(schema.users).where(eq(schema.users.clerkId, userId)).limit(1);
  return again ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Loads a room the signed-in user owns, or sends them back to their rooms. */
export async function requireRoom(roomId: string) {
  const user = await requireUser();
  const db = await getDb();
  const [room] = await db.select().from(schema.rooms).where(and(eq(schema.rooms.id, roomId), eq(schema.rooms.ownerId, user.id))).limit(1);
  if (!room) redirect("/rooms");
  return { user, room, db };
}
