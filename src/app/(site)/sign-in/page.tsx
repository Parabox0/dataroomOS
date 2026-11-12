import Link from "next/link";
import { SignInForm } from "./form";
import { openSample } from "@/app/actions/auth";
import { clerkEnabled } from "@/lib/clerk-config";
import { ClerkSignIn } from "@/components/clerk";

export const metadata = { title: "Sign in" };

export default function SignIn() {
  const clerk = clerkEnabled();
  return (
    <div className="site"><div className="auth stack" style={{ ["--gap" as string]: "16px" }}>
      <h1>Sign in</h1>
      {clerk ? <ClerkSignIn /> : <SignInForm />}
      <p className="muted small">{clerk ? "Just looking?" : <>No account? <Link href="/sign-up">Create one</Link>, or</>}</p>
      {process.env.DATAROOM_DEMO_DATA !== "0" && <form action={openSample}><button className="btn btn-light">Open the sample room</button></form>}
    </div></div>
  );
}
