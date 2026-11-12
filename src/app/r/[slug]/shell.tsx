import { Mark } from "@/components/mark";
import { APP_NAME } from "@/lib/brand";

export function Shell({ company, who, children }: { company: string; who?: string | null; children: React.ReactNode }) {
  return (
    <>
      <header className="viewer-head"><div className="in"><b className="grow">{company}</b>{who && <span className="meta">{who}</span>}</div></header>
      <main className="viewer">{children}</main>
      <p className="powered"><Mark />Shared with {APP_NAME}</p>
    </>
  );
}

export function Closed({ text }: { text: string }) {
  return (
    <main className="auth" style={{ padding: "96px 16px" }}>
      <div className="card"><h1 style={{ fontSize: 22 }}>This room isn’t open</h1><p className="muted" style={{ marginTop: 8 }}>{text}</p></div>
    </main>
  );
}
