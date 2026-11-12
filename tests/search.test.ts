import { describe, it, expect } from "vitest";
import { localAnswer } from "@/lib/search";

const pages = [
  { documentId: "fin", title: "Financial summary", page: 1, text: "Net monthly burn $92,000.\nRunway at current burn 12 months." },
  { documentId: "fin", title: "Financial summary", page: 2, text: "The $2.5M seed closes in Q1 2027. With it, runway is 26 months." },
  { documentId: "cap", title: "Cap table", page: 1, text: "Holder Security Shares Ownership\nAna Ruiz Common 4,200,000 42.0%\nTheo Park Common 3,800,000 38.0%\nTotal 10,000,000 100%" },
];

describe("localAnswer", () => {
  it("answers with numbered sources", () => {
    const a = localAnswer(pages, "What is the runway after the round?");
    expect(a.found).toBe(true);
    expect(a.answer).toContain("26 months");
    expect(a.answer).toMatch(/\[1\]/);
    expect(a.sources[0].title).toBe("Financial summary");
  });
  it("adds the sentence before one that starts with 'With it'", () => {
    const a = localAnswer(pages, "runway with the seed");
    expect(a.answer).toContain("The $2.5M seed closes in Q1 2027. With it");
  });
  it("gives every row of a table", () => {
    const a = localAnswer(pages, "Who owns the company? ownership");
    expect(a.answer).toContain("Ana Ruiz");
    expect(a.answer).toContain("Theo Park");
  });
  it("says so when the files don't cover it", () => {
    expect(localAnswer(pages, "Do you have a dog policy?").found).toBe(false);
  });
});
