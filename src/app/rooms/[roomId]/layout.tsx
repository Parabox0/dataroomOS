import { Suspense } from "react";
import { requireRoom } from "@/lib/auth";
import { roomNav } from "@/lib/nav";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

export default async function RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { room, db, user } = await requireRoom(roomId);
  const nav = await roomNav(db, room.id);
  const side = (
    <Suspense>
      <Sidebar room={{ id: room.id, company: room.company, name: room.name, isSample: room.isSample }} nav={nav} userName={user.name} />
    </Suspense>
  );
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <details className="mobile-nav">
        <summary><span>{room.company}</span><span className="btn-quiet">Menu</span></summary>
        {side}
      </details>
      <div className="app">
        {side}
        <div className="workspace">
          <Suspense>
            <TopBar roomId={room.id} company={room.company} sample={room.isSample} folders={Object.fromEntries(nav.folders.map((f) => [f.id, f.name]))} />
          </Suspense>
          <main id="main" className="main"><div className="content">{children}</div></main>
        </div>
      </div>
    </>
  );
}
