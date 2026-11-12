// The sample room. Everything in it is made up: Brightloaf, its people, the funds and the visitors.
// It is added the first time the app starts with an empty database (turn off with DATAROOM_DEMO_DATA=0).
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { DB } from "./db";
import { schema } from "./db/index";
import { hashPassword } from "./crypto";
import { newId, newSlug } from "./ids";
import { RAISE } from "./checklists";
import { addDocument } from "./ingest";
import { draftReply } from "./answer";
import { localAnswer } from "./search";
import { pageTexts, visibleDocs } from "./room";

export const DEMO_EMAIL = "demo@sample.example";
export const DEMO_PASSWORD = "sample-room";

const FILES: { file: string; title: string; folder: string; hide: boolean }[] = [
  { file: "brightloaf-pitch-deck.pdf", title: "Pitch deck", folder: "Company", hide: true },
  { file: "brightloaf-financial-summary.pdf", title: "Financial summary", folder: "Financials", hide: true },
  { file: "brightloaf-cap-table.pdf", title: "Cap table", folder: "Financials", hide: true },
  // Added before hiding was switched on, so Check the room has something real to find.
  { file: "brightloaf-formation-summary.pdf", title: "Formation summary", folder: "Legal", hide: false },
  { file: "brightloaf-customer-contracts.pdf", title: "Customer contracts", folder: "Customers", hide: true },
  { file: "brightloaf-product-roadmap.pdf", title: "Product roadmap", folder: "Product", hide: true },
  { file: "brightloaf-team-plan.pdf", title: "Team and hiring plan", folder: "Team", hide: true },
];

const NDA = `By opening this room you agree to keep what you read confidential and to use it only to evaluate an investment in Brightloaf, Inc. You will not share these files or their contents with anyone outside your firm. This sample agreement is part of a fictional demo.`;

let running: Promise<void> | null = null;

export async function seedIfEmpty(db: DB) {
  running ??= (async () => {
    const existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, DEMO_EMAIL)).limit(1);
    if (existing.length) return;
    await seed(db);
  })();
  return running;
}

async function seed(db: DB) {
  const now = Date.now();
  const ago = (h: number) => new Date(now - h * 3600_000);
  const userId = newId();
  await db.insert(schema.users).values({ id: userId, email: DEMO_EMAIL, name: "Ana Ruiz", passwordHash: hashPassword(DEMO_PASSWORD) });
  const roomId = newId();
  await db.insert(schema.rooms).values({ id: roomId, ownerId: userId, name: "Seed round", company: "Brightloaf", purpose: "raise", ndaText: NDA, isSample: true, handle: "brightloaf", createdAt: ago(24 * 9) });

  const folderNames = ["Company", "Financials", "Legal", "Customers", "Product", "Team"];
  const folder = new Map<string, string>();
  await db.insert(schema.folders).values(
    folderNames.map((name, position) => {
      const id = newId();
      folder.set(name, id);
      return { id, roomId, name, position };
    }),
  );

  await db.insert(schema.checklistItems).values([
    ...RAISE.map((t, i) => ({ id: newId(), roomId, title: t.title, detail: t.detail, source: "expected", match: t.match, position: i, createdAt: ago(24 * 9) })),
    { id: newId(), roomId, title: "Bakery waste survey results", detail: "The 64 bakery survey behind the waste figure in the deck.", source: "own", position: RAISE.length, createdAt: ago(24 * 6) },
  ]);

  const dir = path.join(process.cwd(), "seed", "files");
  const docId = new Map<string, string>();
  for (const f of FILES) {
    const data = await fs.readFile(path.join(dir, f.file));
    const id = await addDocument(db, { roomId, folderId: folder.get(f.folder)!, fileName: f.file, data: new Uint8Array(data), title: f.title, hideFound: f.hide });
    docId.set(f.title, id);
  }
  await db.update(schema.documents).set({ createdAt: ago(24 * 8), updatedAt: ago(24 * 8) }).where(eq(schema.documents.roomId, roomId));

  // People. Each one has their own link and folder switches.
  type P = { name: string; email: string | null; company: string | null; kind?: string; folders: string[]; nda?: boolean; download?: boolean; created: number };
  const peopleDef: P[] = [
    { name: "Priya Raman", email: "priya@northlight.example", company: "Northlight Capital", folders: ["Company", "Financials", "Customers", "Product", "Team"], nda: true, created: 24 * 6 },
    { name: "Sam Okafor", email: "sam@kilnfund.example", company: "Kiln Fund", folders: folderNames, created: 24 * 7 },
    { name: "Jordan Blake", email: "jordan@seabreak.example", company: "Seabreak Angels", folders: ["Company", "Financials"], download: true, created: 24 * 5 },
    { name: "Anyone with the link", email: null, company: null, kind: "anyone", folders: ["Company"], created: 24 * 4 },
  ];
  const pid = new Map<string, string>();
  for (const p of peopleDef) {
    const id = newId();
    pid.set(p.name, id);
    await db.insert(schema.people).values({
      id,
      roomId,
      kind: p.kind ?? "person",
      name: p.name,
      email: p.email,
      company: p.company,
      slug: newSlug(),
      askEmail: true,
      requireNda: p.nda ?? false,
      watermark: true,
      allowDownload: p.download ?? false,
      canAsk: true,
      createdAt: ago(p.created),
    });
    await db.insert(schema.access).values(p.folders.map((f) => ({ personId: id, folderId: folder.get(f)! })));
  }

  // Reading history: [hoursAgo, minutesLong, [file, page, seconds][]]
  type V = [number, number, [string, number, number][]];
  const history: { person: string; email: string; name: string; visits: V[]; nda?: boolean }[] = [
    {
      person: "Priya Raman", email: "priya@northlight.example", name: "Priya Raman", nda: true,
      visits: [
        [70, 12, [["Pitch deck", 1, 20], ["Pitch deck", 2, 34], ["Pitch deck", 4, 95], ["Pitch deck", 5, 41], ["Pitch deck", 9, 72], ["Financial summary", 1, 160]]],
        [26, 15, [["Financial summary", 1, 120], ["Financial summary", 2, 290], ["Financial summary", 3, 180], ["Cap table", 1, 140], ["Customer contracts", 1, 95]]],
        [3, 9, [["Financial summary", 2, 210], ["Cap table", 1, 120], ["Team and hiring plan", 1, 60], ["Pitch deck", 9, 48]]],
      ],
    },
    {
      person: "Sam Okafor", email: "sam@kilnfund.example", name: "Sam Okafor",
      visits: [
        [110, 6, [["Pitch deck", 1, 15], ["Pitch deck", 4, 40], ["Financial summary", 1, 90], ["Formation summary", 1, 70]]],
        [20, 5, [["Cap table", 1, 190], ["Formation summary", 2, 55], ["Financial summary", 1, 40]]],
      ],
    },
    {
      person: "Jordan Blake", email: "jordan@seabreak.example", name: "Jordan Blake",
      visits: [[118, 3, [["Pitch deck", 1, 12], ["Pitch deck", 2, 18], ["Pitch deck", 4, 40], ["Pitch deck", 9, 30], ["Financial summary", 1, 38]]]],
    },
    { person: "Anyone with the link", email: "lee@harborangels.example", name: "Lee Chen", visits: [[50, 2, [["Pitch deck", 1, 9], ["Pitch deck", 2, 14], ["Pitch deck", 3, 11], ["Pitch deck", 4, 22]]]] },
    { person: "Anyone with the link", email: "mo@tidewater.example", name: "Mo Adeyemi", visits: [[30, 1, [["Pitch deck", 1, 8], ["Pitch deck", 4, 12]]]] },
  ];
  const visitIdFor = new Map<string, string>();
  for (const h of history) {
    for (const [hours, mins, reads] of h.visits) {
      const id = newId();
      visitIdFor.set(h.person, id);
      const startedAt = ago(hours);
      await db.insert(schema.visits).values({
        id,
        personId: pid.get(h.person)!,
        roomId,
        email: h.email,
        name: h.name,
        ndaAcceptedAt: h.nda ? startedAt : null,
        startedAt,
        lastSeenAt: new Date(startedAt.getTime() + mins * 60_000),
      });
      const merged = new Map<string, { documentId: string; pageNumber: number; seconds: number }>();
      for (const [title, page, secs] of reads) {
        const k = `${title}:${page}`;
        const e = merged.get(k) ?? { documentId: docId.get(title)!, pageNumber: page, seconds: 0 };
        e.seconds += secs;
        merged.set(k, e);
      }
      await db.insert(schema.pageTime).values([...merged.values()].map((m) => ({ visitId: id, ...m, firstAt: startedAt })));
    }
  }
  await db.insert(schema.downloads).values({ id: newId(), visitId: visitIdFor.get("Jordan Blake")!, documentId: docId.get("Pitch deck")!, at: ago(117.8) });

  // What viewers typed into Ask, answered from the files they can see.
  const asks: [string, string, number][] = [
    ["Priya Raman", "What is the runway after the round?", 25.5],
    ["Priya Raman", "How much revenue comes from the top five customers?", 25.2],
    ["Sam Okafor", "Who owns the company today?", 19.6],
    ["Jordan Blake", "What is the net revenue retention?", 117.9],
  ];
  for (const [person, query, hours] of asks) {
    const pages = await pageTexts(db, await visibleDocs(db, roomId, pid.get(person)!));
    const a = localAnswer(pages, query);
    await db.insert(schema.asks).values({ id: newId(), roomId, personId: pid.get(person)!, visitId: visitIdFor.get(person), query, answer: a.answer, sources: a.sources, mode: "local", createdAt: ago(hours) });
  }

  // Questions sent to the owner.
  const q1 = "Is Kiln Fund's October SAFE on the cap table yet?";
  const d1 = await draftReply(db, roomId, q1);
  await db.insert(schema.questions).values({ id: newId(), roomId, personId: pid.get("Sam Okafor")!, askerName: "Sam Okafor", text: q1, draft: d1.draft, draftSources: d1.sources, status: "open", createdAt: ago(19.5) });
  const q2 = "Do you have the survey behind the one in eight loaves figure?";
  await db.insert(schema.questions).values({ id: newId(), roomId, personId: pid.get("Priya Raman")!, askerName: "Priya Raman", text: q2, draft: "Thanks for asking. We don't have the survey in the room yet. We'll add it this week and let you know.", draftSources: [], status: "open", createdAt: ago(2.6) });
  const q3 = "What is the post-money cap on this round?";
  const d3 = await draftReply(db, roomId, q3);
  await db.insert(schema.questions).values({ id: newId(), roomId, personId: pid.get("Jordan Blake")!, askerName: "Jordan Blake", text: q3, draft: d3.draft, draftSources: d3.sources, answer: "The round is a SAFE at a $14M post-money valuation cap. It's on page 9 of the deck.", status: "answered", createdAt: ago(117.5), answeredAt: ago(110) });
}
