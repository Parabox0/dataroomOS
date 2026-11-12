import { afterEach, describe, expect, it } from "vitest";
import { clerkEnabled, clerkPublishableKey } from "@/lib/clerk-config";

const keys = ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"];
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
afterEach(() => { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("Clerk switch", () => {
  it("stays off with no keys, so the built-in sign-in is used", () => {
    for (const k of keys) delete process.env[k];
    expect(clerkEnabled()).toBe(false);
  });
  it("stays off with only the public key, so a half-finished setup can't lock anyone out", () => {
    for (const k of keys) delete process.env[k];
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_x";
    expect(clerkEnabled()).toBe(false);
  });
  it("turns on with both keys", () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_x";
    process.env.CLERK_SECRET_KEY = "sk_test_x";
    expect(clerkEnabled()).toBe(true);
    expect(clerkPublishableKey()).toBe("pk_test_x");
  });
});
