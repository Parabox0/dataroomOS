"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { Submit, Notice } from "@/components/forms";

export function SignInForm() {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="card stack on-card" style={{ ["--gap" as string]: "14px" }}>
      <label className="field"><span>Email</span><input className="input" type="email" name="email" autoComplete="email" required /></label>
      <label className="field"><span>Password</span><input className="input" type="password" name="password" autoComplete="current-password" required /></label>
      <Notice state={state} />
      <Submit pending="Signing in…">Sign in</Submit>
    </form>
  );
}
