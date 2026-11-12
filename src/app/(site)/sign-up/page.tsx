import Link from "next/link";
import { SignUpForm } from "./form";
import { clerkEnabled } from "@/lib/clerk-config";
import { ClerkSignUp } from "@/components/clerk";

export const metadata = { title: "Create an account" };

export default function SignUp() {
  const clerk = clerkEnabled();
  return (
    <div className="site"><div className="auth stack" style={{ ["--gap" as string]: "16px" }}>
      <h1>Create your account</h1>
      <p className="muted">Then make your first room. It takes about a minute.</p>
      {clerk ? <ClerkSignUp /> : <SignUpForm />}
      {!clerk && <p className="muted small">Already have one? <Link href="/sign-in">Sign in</Link></p>}
    </div></div>
  );
}
