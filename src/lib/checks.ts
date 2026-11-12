// Check the room: plain-language problems an investor or buyer would notice.
// Pure function over room data, so it is easy to test. check-room.ts loads the data and saves the results.
import { findDates, plural, clip, sentences } from "./text";

export type CheckDoc = { id: string; title: string; folderId: string | null; pages: { number: number; text: string }[] };
export type CheckInput = {
  docs: CheckDoc[];
  checklist: { title: string; status: string; source: string }[];
  sensitive: { documentId: string; kind: string; hidden: boolean }[];
  /** Folders at least one person can see. */
  sharedFolderIds: Set<string>;
};
export type Finding = { key: string; title: string; detail: string; documentId?: string };

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function runChecks(input: CheckInput): Finding[] {
  const out: Finding[] = [];
  const docText = (d: CheckDoc) => d.pages.map((p) => p.text).join("\n");

  // 1. Expected files that are still missing.
  for (const item of input.checklist) {
    if (item.source === "expected" && item.status !== "done") {
      out.push({ key: `missing:${item.title}`, title: `Add ${item.title.toLowerCase()}`, detail: `Most investors ask for this, and the room does not have it yet.` });
    }
  }

  // 2. Personal details that people can see.
  const byDoc = new Map<string, { kinds: Set<string>; n: number }>();
  for (const s of input.sensitive) {
    if (s.hidden) continue;
    const d = input.docs.find((x) => x.id === s.documentId);
    if (!d?.folderId || !input.sharedFolderIds.has(d.folderId)) continue;
    const e = byDoc.get(d.id) ?? { kinds: new Set(), n: 0 };
    e.kinds.add(s.kind.replace(/^[A-Z][a-z]/, (m) => m.toLowerCase()));
    e.n++;
    byDoc.set(d.id, e);
  }
  for (const [id, e] of byDoc) {
    const d = input.docs.find((x) => x.id === id)!;
    out.push({
      key: `visible:${id}`,
      title: `Hide personal details in ${d.title}`,
      detail: `${plural(e.n, "detail")} (${[...e.kinds].join(", ")}) can be read by people you shared this folder with.`,
      documentId: id,
    });
  }

  // 3. A cap table dated before a round or SAFE that other files mention.
  const cap = input.docs.find((d) => /cap(italization)? table/i.test(d.title) || /capitalization table/i.test(d.pages[0]?.text ?? ""));
  if (cap) {
    const asOf = findDates(docText(cap)).find((x) => /as of/i.test(docText(cap).slice(Math.max(0, x.index - 12), x.index)));
    if (asOf) {
      for (const d of input.docs) {
        if (d.id === cap.id) continue;
        for (const s of d.pages.flatMap((p) => sentences(p.text))) {
          if (!/\b(safe|note|round|invest\w*|closed|signed)\b/i.test(s)) continue;
          const later = findDates(s).find((x) => x.date > asOf.date);
          if (!later || !/\bsafe\b|note|invest/i.test(s)) continue;
          out.push({
            key: `stale-cap:${cap.id}`,
            title: "Update the cap table",
            detail: `${cap.title} is dated ${fmt(asOf.date)}, but ${d.title} mentions an investment on ${fmt(later.date)}. Investors will ask whether it is included.`,
            documentId: cap.id,
          });
          break;
        }
        if (out.some((f) => f.key === `stale-cap:${cap.id}`)) break;
      }
    }
  }

  // 4. Loose ends the files admit to.
  for (const d of input.docs) {
    for (const s of d.pages.flatMap((p) => sentences(p.text))) {
      if (/\b(being collected|not yet signed|to be signed|pending signature|still missing|outstanding)\b/i.test(s)) {
        out.push({ key: `open:${d.id}:${s.slice(0, 40)}`, title: `Close an open item in ${d.title}`, detail: `The file says: "${clip(s, 180)}"`, documentId: d.id });
      }
    }
  }

  // 5. Pages with no text (scans), which Ask cannot read.
  for (const d of input.docs) {
    const empty = d.pages.filter((p) => p.text.replace(/\s/g, "").length < 20).length;
    if (empty) out.push({ key: `scan:${d.id}`, title: `Add a text version of ${d.title}`, detail: `${plural(empty, "page")} has no readable text, so Ask cannot answer from ${empty === 1 ? "it" : "them"}.`, documentId: d.id });
  }

  // 6. Files nobody can see, because they are not in a folder.
  for (const d of input.docs) {
    if (!d.folderId) out.push({ key: `nofolder:${d.id}`, title: `Put ${d.title} in a folder`, detail: "Files outside a folder are only visible to you.", documentId: d.id });
  }

  return out;
}
