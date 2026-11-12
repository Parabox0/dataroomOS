import { SiteNav } from "@/components/site";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <SiteNav />
      <main id="main">{children}</main>
    </>
  );
}
