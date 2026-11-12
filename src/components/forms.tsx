"use client";
import { useFormStatus } from "react-dom";

export function Submit({ children, pending, className = "btn", ...rest }: { children?: React.ReactNode; pending?: string; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending: busy } = useFormStatus();
  return (
    <button className={className} disabled={busy} aria-disabled={busy} {...rest}>
      {busy && pending ? pending : children}
    </button>
  );
}

export function Notice({ state }: { state?: { error?: string; ok?: string } }) {
  if (!state) return null;
  if (state.error) return <p className="error" role="alert">{state.error}</p>;
  if (state.ok) return <p className="muted small" role="status">{state.ok}</p>;
  return null;
}
