import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { signOut } from "@/app/actions/auth";
import { NewRoomForm } from "./new-room";
import { clerkEnabled } from "@/lib/clerk-config";
import { ClerkSignOutButton } from "@/components/clerk";
import { Mark } from "@/components/mark";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Your rooms" };

export default async function Rooms({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  const db = await getDb();
  const rooms = await db.select().from(schema.rooms).where(eq(schema.rooms.ownerId, user.id)).orderBy(desc(schema.rooms.createdAt));
  const fresh = (await searchParams).new === "1";
  return (
    <>
      <header className="appbar">
        <div className="in">
          <Link href="/" className="brand"><Mark />{APP_NAME}</Link>
          <span className="meta">{user.name}</span>
          {clerkEnabled() ? <ClerkSignOutButton /> : <form action={signOut}><button className="btn-quiet">Sign out</button></form>}
        </div>
      </header>
      <main className="plain" id="main">
        <div className="page-head">
          <div>
            <h1>{fresh ? `Welcome, ${user.name.split(" ")[0]}` : "Your rooms"}</h1>
            <p className="muted">{rooms.length ? "Pick a room, or start a new one below." : "Start your first room. It comes with the checklist investors usually expect."}</p>
          </div>
        </div>
        {rooms.length > 0 && (
          <div className="card card-flush">
            <ul className="list">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Link href={`/rooms/${r.id}`} className="item grow">
                    <p className="title">{r.company}, {r.name}</p>
                    <p className="meta">{r.purpose === "sell" ? "Selling the business" : "Raising a round"}{r.isSample ? " · Sample room, everything in it is made up" : ""}</p>
                  </Link>
                  <span className="meta" aria-hidden>Open</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <NewRoomForm />
      </main>
    </>
  );
}
