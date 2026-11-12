"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { Submit, Notice } from "@/components/forms";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, undefined);
  return (
    <form action={action} className="card stack on-card" style={{ ["--gap" as string]: "14px" }}>
      <label className="field"><span>Your name</span><input className="input" name="name" autoComplete="name" required /></label>
      <label className="field"><span>Email</span><input className="input" type="email" name="email" autoComplete="email" required /></label>
      <label className="field"><span>Password</span><input className="input" type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
      <p className="meta">By creating an account you agree to the draft <Link href="/terms">terms</Link> and <Link href="/privacy">privacy</Link> notes.</p>
      <Notice state={state} />
      <Submit pending="Creating…">Create account</Submit>
    </form>
  );
}
