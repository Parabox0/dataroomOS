import { describe, it, expect } from "vitest";
import { runChecks } from "@/lib/checks";

describe("runChecks", () => {
  const base = {
    docs: [
      { id: "cap", title: "Cap table", folderId: "f1", pages: [{ number: 1, text: "Cap table as of August 1, 2026." }] },
      { id: "fin", title: "Financial summary", folderId: "f1", pages: [{ number: 1, text: "Kiln Fund invested on October 3, 2026." }] },
      { id: "loose", title: "Notes", folderId: null, pages: [{ number: 1, text: "Draft." }] },
    ],
    checklist: [{ title: "Signed SAFEs and notes", status: "todo", source: "expected" }],
    sensitive: [{ documentId: "fin", kind: "Email address", hidden: false }],
    sharedFolderIds: new Set(["f1"]),
  };
  const keys = runChecks(base).map((f) => f.key.split(":")[0]);
  it("finds a stale cap table", () => expect(keys).toContain("stale-cap"));
  it("finds visible personal details in shared folders", () => expect(keys).toContain("visible"));
  it("lists missing expected items", () => expect(keys).toContain("missing"));
  it("finds files outside folders", () => expect(keys).toContain("nofolder"));
});
