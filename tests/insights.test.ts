import { describe, it, expect } from "vitest";
import { insightFor } from "@/lib/insights";

const now = new Date("2026-11-12T12:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3600_000);
const titles = new Map([["fin", "Financial summary"], ["deck", "Pitch deck"]]);

describe("insightFor", () => {
  it("writes one sentence about what they read", () => {
    const i = insightFor(
      [{ id: "v1", startedAt: ago(30), lastSeenAt: ago(29) }, { id: "v2", startedAt: ago(3), lastSeenAt: ago(3) }],
      [
        { visitId: "v1", documentId: "fin", pageNumber: 2, seconds: 900, firstAt: ago(30) },
        { visitId: "v2", documentId: "deck", pageNumber: 1, seconds: 300, firstAt: ago(3) },
      ],
      titles, ["Do you have the survey?"], now,
    );
    expect(i.sentence).toMatch(/^Read for 20 min, mostly Financial summary \(longest on page 2\) and Pitch deck/);
    expect(i.sentence).toContain("asked “Do you have the survey?”");
    expect(i.leaningIn).toBe(true);
  });
  it("does not call a short visit leaning in", () => {
    const i = insightFor([{ id: "v1", startedAt: ago(2), lastSeenAt: ago(2) }], [{ visitId: "v1", documentId: "deck", pageNumber: 1, seconds: 120, firstAt: ago(2) }], titles, ["What is the cap?"], now);
    expect(i.leaningIn).toBe(false);
  });
});
