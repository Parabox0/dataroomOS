// "Who is leaning in": one plain sentence per person, from what they actually read.
// Pure function, tested in tests/insights.test.ts.
import { minutes, plural } from "./text";

export type VisitRow = { id: string; startedAt: Date; lastSeenAt: Date };
export type TimeRow = { visitId: string; documentId: string; pageNumber: number; seconds: number; firstAt: Date };
export type Insight = {
  seconds: number;
  visits: number;
  lastSeen: Date | null;
  topDocs: { documentId: string; title: string; seconds: number; topPage: number }[];
  leaningIn: boolean;
  sentence: string;
};

const WEEK = 7 * 86400_000;

export function insightFor(
  visits: VisitRow[],
  time: TimeRow[],
  titles: Map<string, string>,
  asked: string[],
  now = new Date(),
): Insight {
  const seconds = time.reduce((a, t) => a + t.seconds, 0);
  const lastSeen = visits.length ? new Date(Math.max(...visits.map((v) => v.lastSeenAt.getTime()))) : null;
  const perDoc = new Map<string, { seconds: number; pages: Map<number, number> }>();
  for (const t of time) {
    const e = perDoc.get(t.documentId) ?? { seconds: 0, pages: new Map() };
    e.seconds += t.seconds;
    e.pages.set(t.pageNumber, (e.pages.get(t.pageNumber) ?? 0) + t.seconds);
    perDoc.set(t.documentId, e);
  }
  const topDocs = [...perDoc.entries()]
    .map(([documentId, e]) => ({ documentId, title: titles.get(documentId) ?? "a file", seconds: e.seconds, topPage: [...e.pages.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.seconds - a.seconds);

  const recentVisits = visits.filter((v) => now.getTime() - v.lastSeenAt.getTime() < WEEK).length;
  const recentSeconds = time.filter((t) => now.getTime() - t.firstAt.getTime() < WEEK).reduce((a, t) => a + t.seconds, 0);
  const leaningIn = recentSeconds >= 600 || (recentVisits >= 2 && recentSeconds >= 240);

  let sentence: string;
  if (!visits.length) sentence = "Has not opened the room yet.";
  else if (!seconds) sentence = "Opened the room but has not read any page yet.";
  else {
    const parts: string[] = [];
    const a = topDocs[0];
    parts.push(`Read for ${minutes(seconds)}, mostly ${a.title}${a.seconds >= 60 ? ` (longest on page ${a.topPage})` : ""}`);
    if (topDocs[1]) parts[0] += ` and ${topDocs[1].title}`;
    const back = visits.length - 1;
    if (back > 0) parts.push(`came back ${back === 1 ? "once" : back === 2 ? "twice" : plural(back, "time")}`);
    if (asked.length) parts.push(`asked “${asked[0].length > 60 ? asked[0].slice(0, 58).trimEnd() + "…" : asked[0]}”`);
    sentence = parts.join(", ") + ".";
    sentence = sentence[0].toUpperCase() + sentence.slice(1);
  }
  return { seconds, visits: visits.length, lastSeen, topDocs, leaningIn, sentence };
}
