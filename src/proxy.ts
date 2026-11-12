// Runs before every page. When Clerk is switched on, Clerk reads its sign-in cookie here so pages can ask who is signed in.
// Pages still decide for themselves who may see them, so nothing is blocked at this step.
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from "next/server";
import { clerkEnabled, clerkPublishableKey } from "@/lib/clerk-config";

let clerk: NextMiddleware | undefined;

export default function proxy(req: NextRequest, ev: NextFetchEvent) {
  if (!clerkEnabled()) return NextResponse.next();
  // Clerk reads CLERK_SECRET_KEY from the server settings itself.
  clerk ??= clerkMiddleware(() => {}, { publishableKey: clerkPublishableKey() });
  return clerk(req, ev);
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
