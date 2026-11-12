import { describe, it, expect } from "vitest";
import { sentences, unwrap, queryTerms } from "@/lib/text";

describe("unwrap", () => {
  it("joins a sentence that wraps onto the next line", () => {
    const t = "All founders and employees have signed invention assignment agreements, except two\ncontractors whose agreements are being collected.";
    expect(unwrap(t)).not.toContain("\n");
  });
  it("keeps table rows on their own lines", () => {
    const t = "Ana Ruiz Common 4,200,000 42.0%\nTheo Park Common 3,800,000 38.0%";
    expect(unwrap(t).split("\n")).toHaveLength(2);
  });
});

describe("sentences", () => {
  it("splits on sentence ends and drops lone bullets", () => {
    expect(sentences("The seed closes in Q1. Runway is 26 months.\n•\nNext")).toEqual(["The seed closes in Q1.", "Runway is 26 months.", "Next"]);
  });
});

describe("queryTerms", () => {
  it("weighs filler words lower than the subject", () => {
    const terms = queryTerms("What is the runway today?");
    expect(terms.get("runway")).toBe(1);
    expect(terms.get("today") ?? 0).toBeLessThan(1);
  });
});
