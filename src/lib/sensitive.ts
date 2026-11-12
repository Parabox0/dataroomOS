// Finds personal and account details on a page so the owner can hide them on shared pages.
import type { TextLine, Box } from "./db/schema";
import { boxFor, type Measure } from "./boxes";

export type Found = { kind: string; value: string; boxes: Box[] };

const PATTERNS: { kind: string; re: RegExp; needs?: RegExp }[] = [
  { kind: "Email address", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { kind: "Phone number", re: /(?:\+?1[\s.-]?)?\(\d{3}\)\s?\d{3}[\s.-]\d{4}|\b\d{3}[.-]\d{3}[.-]\d{4}\b/g },
  { kind: "ID number", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: "Tax ID", re: /\b\d{2}-\d{7}\b/g },
  { kind: "Account number", re: /\b\d{8,17}\b/g, needs: /account|acct|iban|routing/i },
];

export function findSensitive(lines: TextLine[], measure?: Measure): Found[] {
  const found: Found[] = [];
  for (const line of lines) {
    for (const p of PATTERNS) {
      if (p.needs && !p.needs.test(line.str)) continue;
      for (const m of line.str.matchAll(p.re)) {
        const value = m[0].trim();
        found.push({ kind: p.kind, value, boxes: [boxFor(line, (m.index ?? 0) + m[0].indexOf(value), value.length, measure)] });
      }
    }
  }
  return found;
}

/** True when a sentence carries personal details, so summaries can leave it out. */
export function hasSensitive(text: string): boolean {
  return PATTERNS.some((p) => (!p.needs || p.needs.test(text)) && new RegExp(p.re.source, p.re.flags).test(text));
}
