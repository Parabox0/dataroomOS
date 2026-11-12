"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { hashPassword, checkPassword } from "@/lib/crypto";
import { startSession, endSession } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { DEMO_EMAIL } from "@/lib/seed";
import { clerkEnabled } from "@/lib/clerk-config";

export type FormState = { error?: string; ok?: string } | undefined;

const SignUp = z.object({
  name: z.string().trim().min(1, "Add your name.").max(80),
  email: z.string().trim().toLowerCase().email("That email doesn't look right."),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
});

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  if (clerkEnabled()) return { error: "Sign up with the form above." };
  const parsed = SignUp.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await getDb();
  const { name, email, password } = parsed.data;
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (exists) return { error: "There is already an account with that email. Sign in instead." };
  const id = newId();
  await db.insert(schema.users).values({ id, email, name, passwordHash: hashPassword(password) });
  await startSession(id);
  redirect("/rooms?new=1");
}

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  if (clerkEnabled()) return { error: "Sign in with the form above." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user || !checkPassword(password, user.passwordHash)) return { error: "That email and password don't match an account." };
  await startSession(user.id);
  redirect("/rooms");
}

/** Signs in to the sample account, so anyone can try the product without making an account. */
export async function openSample() {
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, DEMO_EMAIL)).limit(1);
  if (!user) redirect("/sign-up");
  await startSession(user.id);
  const [room] = await db.select().from(schema.rooms).where(eq(schema.rooms.ownerId, user.id)).limit(1);
  redirect(room ? `/rooms/${room.id}` : "/rooms");
}

export async function signOut() {
  await endSession();
  redirect("/");
}

/** Ends the app's own session without leaving the page, for when Clerk signs the person out next. */
export async function endOwnSession() {
  await endSession();
}

