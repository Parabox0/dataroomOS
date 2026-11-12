// Small text helpers shared by search, answers, summaries and checks. No dependencies, easy to test.

const STOP = new Set(
  "a an and are as at be by can could did do does for from had has have how i in is it its of on or our that the their them there these they this to was we were what when where which who why will with you your about into than then so if any all much many".split(" "),
);

/** Words that mean the same thing in a data room, so "burn rate" finds "net monthly burn". */
const SYNONYMS: Record<string, string[]> = {
  revenue: ["arr", "mrr", "sales"],
  arr: ["revenue", "recurring"],
  runway: ["burn", "cash", "months"],
  burn: ["runway", "spend"],
  cap: ["capitalization", "ownership"],
  captable: ["capitalization", "ownership", "shares"],
  capitalization: ["ownership", "shares"],
  own: ["ownership", "shares"],
  owns: ["ownership", "shares"],
  valuation: ["cap", "post-money"],
  customer: ["customers", "bakeries", "clients", "contracts"],
  client: ["customer", "customers"],
  employee: ["headcount", "team", "hires"],
  hire: ["hiring", "headcount"],
  churn: ["retention", "cancel"],
  retention: ["churn", "nrr"],
  nrr: ["retention", "net"],
  margin: ["gross"],
  raise: ["round", "safe", "raising"],
  raising: ["round", "safe"],
  round: ["safe", "raising", "seed"],
  founder: ["founders", "ceo", "cto"],
  ceo: ["founder", "chief"],
  incorporated: ["incorporation", "delaware", "formation"],
  ip: ["intellectual", "property", "invention", "assignment"],
  roadmap: ["product", "plan"],
  growth: ["growing", "monthly"],
  waste: ["throw"],
};

export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 3 && w.endsWith("es") && !w.endsWith("ses")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  return w;
}

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9$%][a-z0-9$%.'-]*/g) ?? [])
    .map((t) => t.replace(/[.'-]+$/, ""))
    .filter((t) => t && !STOP.has(t))
    .map(stem);
}

/** Words that say little on their own in a question, so they count for less. */
const LOW = new Set("company today now current currently please tell know total much number startup business after before right".split(" "));

/** Query words plus their synonyms (synonyms count for less). */
export function queryTerms(query: string): Map<string, number> {
  const q = query.toLowerCase().replace(/cap table/g, "captable capitalization").replace(/'s\b/g, "");
  const terms = new Map<string, number>();
  for (const w of q.match(/[a-z0-9$%][a-z0-9$%.-]*/g) ?? []) {
    const raw = w.replace(/[.-]+$/, "");
    if (!raw || STOP.has(raw)) continue;
    const t = stem(raw);
    terms.set(t, Math.max(terms.get(t) ?? 0, LOW.has(raw) ? 0.3 : 1));
    for (const s of SYNONYMS[raw] ?? SYNONYMS[t] ?? []) {
      const st = stem(s);
      if (!terms.has(st)) terms.set(st, 0.5);
    }
  }
  return terms;
}

/** Joins lines that a PDF wrapped mid-sentence, but keeps table rows and bullets apart. */
export function unwrap(text: string): string {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    const prev = out.at(-1);
    const wrapped = prev && !/[.!?:;]$/.test(prev) && !/^[•\-–]/.test(line) && ((prev.length >= 60 && (prev.match(/\b[a-z][a-z'-]*\b/g) ?? []).length >= 6) || /^[a-z(]/.test(line));
    if (wrapped) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out.join("\n");
}

export function sentences(text: string): string[] {
  return unwrap(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9$(])|\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 2 && s !== "•");
}

export function clip(s: string, n = 220) {
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Finds dates written like "October 3, 2026" or "August 1, 2026". */
export function findDates(text: string): { date: Date; raw: string; index: number }[] {
  const re = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/g;
  const out: { date: Date; raw: string; index: number }[] = [];
  for (const m of text.matchAll(re)) {
    const month = MONTHS.indexOf(m[1].toLowerCase());
    out.push({ date: new Date(Date.UTC(Number(m[3]), month, Number(m[2]))), raw: m[0], index: m.index ?? 0 });
  }
  return out;
}

export function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}

export function minutes(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  const m = Math.round(seconds / 60);
  return `${m} min`;
}
