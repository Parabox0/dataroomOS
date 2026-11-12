import { describe, it, expect } from "vitest";
import { findSensitive, hasSensitive } from "@/lib/sensitive";

const line = (str: string) => ({ str, x: 100, y: 200, w: str.length * 10, h: 20 });

describe("findSensitive", () => {
  it("finds emails, phones, ID and tax numbers", () => {
    const found = findSensitive([line("Contact ana@brightloaf.example or (305) 555-0142"), line("SSN 123-45-6789, EIN 12-3456789")]);
    expect(found.map((f) => f.kind).sort()).toEqual(["Email address", "ID number", "Phone number", "Tax ID"]);
  });
  it("only treats long numbers as accounts when the line says account", () => {
    expect(findSensitive([line("Invoice 123456789012")])).toHaveLength(0);
    expect(findSensitive([line("Operating account 123456789012")])[0].kind).toBe("Account number");
  });
  it("puts the box over the match, with padding", () => {
    const [f] = findSensitive([line("Email: ana@b.example")]);
    const box = f.boxes[0];
    expect(box.x).toBeLessThan(100 + 7 * 10);
    expect(box.x + box.w).toBeGreaterThanOrEqual(100 + 20 * 10);
  });
});

describe("hasSensitive", () => {
  it("flags sentences with personal details", () => {
    expect(hasSensitive("Reach the founder at ana@brightloaf.example.")).toBe(true);
    expect(hasSensitive("Brightloaf is a Delaware C corporation.")).toBe(false);
  });
});
