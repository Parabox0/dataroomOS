"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAMES: Record<string, string> = {
  checklist: "Checklist", documents: "Documents", ask: "Ask the room", check: "Check the room",
  questions: "Questions", people: "People", history: "History", settings: "Room settings",
};

/** The thin bar above every room page: where you are, and whether this is the sample. */
export function TopBar({ roomId, company, sample, folders }: { roomId: string; company: string; sample: boolean; folders: Record<string, string> }) {
  const path = usePathname();
  const sp = useSearchParams();
  const parts = path.split("/").slice(3);
  const section = NAMES[parts[0] ?? "checklist"] ?? "Checklist";
  const base = `/rooms/${roomId}`;
  const sub = parts[0] === "documents" && sp.get("folder") ? folders[sp.get("folder")!] : parts.length > 1 ? (parts[0] === "people" ? "Person" : parts[0] === "documents" ? "File" : undefined) : undefined;
  return (
    <div className="topbar">
      <span className="crumb"><Link href="/rooms">{company}</Link></span>
      <span className="sep">/</span>
      {sub ? (
        <>
          <span className="crumb"><Link href={`${base}/${parts[0]}`}>{section}</Link></span>
          <span className="sep">/</span>
          <span className="here">{sub}</span>
        </>
      ) : (
        <span className="here">{section}</span>
      )}
      {sample && <span className="tag" style={{ marginLeft: "auto" }}>Sample room, everything in it is made up</span>}
    </div>
  );
}
