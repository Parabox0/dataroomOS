"use client";
// Clerk's sign-in and sign-up boxes, styled to match the rest of Dataroom OS.
import { SignIn, SignUp, useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { endOwnSession } from "@/app/actions/auth";

export const clerkLook = {
  variables: {
    colorPrimary: "#191918",
    colorText: "#191918",
    colorTextSecondary: "#6b6a66",
    colorBackground: "#ffffff",
    borderRadius: "6px",
    fontFamily: '"InterLocal", "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", border: "1px solid #ebeae7", borderRadius: "10px" },
  },
};

export function ClerkSignIn() {
  return <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/rooms" appearance={clerkLook} />;
}

export function ClerkSignUp() {
  return <SignUp routing="hash" signInUrl="/sign-in" fallbackRedirectUrl="/rooms?new=1" appearance={clerkLook} />;
}

/** Signs out of both the sample room session and Clerk, then goes home. */
export function ClerkSignOutButton() {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-quiet"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await endOwnSession();
        await signOut({ redirectUrl: "/" });
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
