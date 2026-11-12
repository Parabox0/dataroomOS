import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { Mark } from "./mark";

export function SiteNav() {
  return (
    <header className="site-head">
      <div className="frame">
        <nav className="site-nav" aria-label="Main">
          <Link href="/" className="brand"><Mark />{APP_NAME}</Link>
          <div className="end">
            <Link href="/sign-in" className="link">Sign in</Link>
            <Link href="/sign-up" className="btn">Create account</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
