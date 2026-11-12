"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { RoomNav } from "@/lib/nav";
import { Mark } from "@/components/mark";
import { APP_NAME } from "@/lib/brand";

export function Sidebar({ room, nav, userName }: { room: { id: string; company: string; name: string; isSample: boolean }; nav: RoomNav; userName: string }) {
  const path = usePathname();
  const sp = useSearchParams();
  const base = `/rooms/${room.id}`;
  const is = (href: string) => {
    const [p, q] = href.split("?");
    if (p !== path) return false;
    if (!q) return !sp.toString() || (p.endsWith("/documents") ? !sp.get("folder") : !sp.get("view"));
    const [k, v] = q.split("=");
    return sp.get(k) === v;
  };
  const L = ({ href, children, n, dot }: { href: string; children: React.ReactNode; n?: number; dot?: boolean }) => (
    <Link href={href} className="nav" aria-current={is(href) ? "page" : undefined}>
      <span>{children}</span>
      {dot ? <span className="dot" aria-label="Needs you" /> : n ? <span className="n">{n}</span> : null}
    </Link>
  );
  return (
    <nav className="side" aria-label="Room">
      <Link href="/rooms" className="brand"><Mark />{APP_NAME}</Link>
      <Link href="/rooms" className="room" title="Switch room">
        <b>{room.company}</b>
        <span className="meta">{room.name}{room.isSample ? " · sample" : ""}</span>
      </Link>

      <h4>Checklist</h4>
      <L href={`${base}/checklist`} n={nav.todo}>To do</L>
      <L href={`${base}/checklist?view=done`} n={nav.done}>Done</L>
      <L href={`${base}/checklist?view=requests`} dot={nav.requests > 0}>Requests</L>

      <h4>Documents</h4>
      <L href={`${base}/documents`} n={nav.total}>All</L>
      {nav.folders.map((f) => (
        <L key={f.id} href={`${base}/documents?folder=${f.id}`} n={f.count}>{f.name}</L>
      ))}

      <h4>Ask</h4>
      <L href={`${base}/ask`}>Ask the room</L>
      <L href={`${base}/check`}>Check the room</L>

      <h4>Questions</h4>
      <L href={`${base}/questions`} dot={nav.open > 0}>Open</L>
      <L href={`${base}/questions?view=answered`} n={nav.answered}>Answered</L>

      <h4>Sharing</h4>
      <L href={`${base}/people`} dot={nav.leaningIn > 0}>People</L>
      <L href={`${base}/history`}>History</L>

      <div className="foot stack" style={{ ["--gap" as string]: "4px" }}>
        <Link href={`${base}/settings`}>Room settings</Link>
        <p className="meta">Signed in as {userName}</p>
      </div>
    </nav>
  );
}
