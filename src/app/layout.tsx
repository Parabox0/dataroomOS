import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkEnabled, clerkPublishableKey } from "@/lib/clerk-config";
import "./globals.css";
import { APP_NAME } from "@/lib/brand";

// Pages are drawn when someone asks for them, so Clerk's keys can be read from the server's settings at that moment.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Share files with investors or buyers. It checks the room before they do, answers questions with sources, and tells you who is serious.",
};

export const viewport: Viewport = { themeColor: "#f5f5f7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
  return clerkEnabled() ? (
    <ClerkProvider publishableKey={clerkPublishableKey()} signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/">
      {page}
    </ClerkProvider>
  ) : (
    page
  );
}
