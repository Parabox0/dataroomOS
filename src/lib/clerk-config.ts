// Clerk sign-in switches on when both Clerk keys are set (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY).
// Without them the app keeps its own email and password sign-in, so it still runs on any computer.
export function clerkPublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || undefined;
}

export function clerkEnabled(): boolean {
  return Boolean(clerkPublishableKey() && process.env.CLERK_SECRET_KEY);
}
