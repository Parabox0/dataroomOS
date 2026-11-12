// Database tables for Dataroom OS. Works on PGlite (local) and any Postgres, including Supabase.
import { pgTable, text, integer, boolean, timestamp, jsonb, real, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  // Set when the person signs in through Clerk. Empty password hash then, since Clerk holds the sign-in.
  clerkId: text("clerk_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** A data room. purpose picks the checklist: "raise" (raising a round) or "sell" (selling a business). */
export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  company: text("company").notNull(),
  purpose: text("purpose").notNull().default("raise"),
  ndaText: text("nda_text"),
  isSample: boolean("is_sample").notNull().default(false),
  /** The short room address: the site's address, a slash, then this. */
  handle: text("handle").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const folders = pgTable("folders", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
}, (t) => [index("folders_room_idx").on(t.roomId)]);

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  pageCount: integer("page_count").notNull().default(0),
  version: integer("version").notNull().default(1),
  /** "ready" once pages are rendered, "failed" if the file could not be read. */
  status: text("status").notNull().default("ready"),
  summary: text("summary"),
  /** "claude" when written by Claude, "local" when built from the file's own sentences. */
  summarySource: text("summary_source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("documents_room_idx").on(t.roomId)]);

export type TextLine = { str: string; x: number; y: number; w: number; h: number };

export const pages = pgTable("pages", {
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  text: text("text").notNull().default(""),
  /** Text lines with their position on the page image, in image pixels. Used to place hidden-info boxes. */
  lines: jsonb("lines").$type<TextLine[]>().notNull().default([]),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  imageKey: text("image_key").notNull(),
}, (t) => [primaryKey({ columns: [t.documentId, t.number] })]);

export type Box = { x: number; y: number; w: number; h: number };

/** Emails, phone numbers, ID and account numbers found on upload. hidden = blacked out on shared pages. */
export const sensitiveItems = pgTable("sensitive_items", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull(),
  kind: text("kind").notNull(),
  value: text("value").notNull(),
  boxes: jsonb("boxes").$type<Box[]>().notNull().default([]),
  hidden: boolean("hidden").notNull().default(false),
}, (t) => [index("sensitive_doc_idx").on(t.documentId)]);

/** The checklist is the room. source: expected (from the template), own, request (from a viewer), check (from Check the room). */
export const checklistItems = pgTable("checklist_items", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  detail: text("detail"),
  source: text("source").notNull().default("own"),
  status: text("status").notNull().default("todo"),
  documentId: text("document_id").references(() => documents.id, { onDelete: "set null" }),
  /** For template items: keywords that match a file to this item. */
  match: text("match"),
  personId: text("person_id"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("checklist_room_idx").on(t.roomId)]);

/**
 * A person the room is shared with, or "anyone with the link" (kind = "anyone").
 * Each person has their own link, their own rules and their own folder switches.
 */
export const people = pgTable("people", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("person"),
  name: text("name").notNull(),
  email: text("email"),
  company: text("company"),
  slug: text("slug").notNull(),
  askEmail: boolean("ask_email").notNull().default(true),
  passwordHash: text("password_hash"),
  requireNda: boolean("require_nda").notNull().default(false),
  watermark: boolean("watermark").notNull().default(true),
  allowDownload: boolean("allow_download").notNull().default(false),
  canAsk: boolean("can_ask").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("people_slug_idx").on(t.slug), index("people_room_idx").on(t.roomId)]);

/** One switch per folder per person: a row here means "Can see". */
export const access = pgTable("access", {
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  folderId: text("folder_id").notNull().references(() => folders.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.personId, t.folderId] })]);

/** One visit through a link. A visit token cookie ties page time to it. */
export const visits = pgTable("visits", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  email: text("email"),
  name: text("name"),
  ndaAcceptedAt: timestamp("nda_accepted_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("visits_person_idx").on(t.personId), index("visits_room_idx").on(t.roomId)]);

/** Active seconds on one page during one visit. */
export const pageTime = pgTable("page_time", {
  visitId: text("visit_id").notNull().references(() => visits.id, { onDelete: "cascade" }),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull(),
  seconds: real("seconds").notNull().default(0),
  firstAt: timestamp("first_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.visitId, t.documentId, t.pageNumber] })]);

export const downloads = pgTable("downloads", {
  id: text("id").primaryKey(),
  visitId: text("visit_id").notNull().references(() => visits.id, { onDelete: "cascade" }),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export type Source = { n: number; documentId: string; title: string; page: number; quote: string };

/** Everything typed into Ask, by owners (personId null) and viewers. */
export const asks = pgTable("asks", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  personId: text("person_id").references(() => people.id, { onDelete: "cascade" }),
  visitId: text("visit_id"),
  query: text("query").notNull(),
  answer: text("answer").notNull(),
  sources: jsonb("sources").$type<Source[]>().notNull().default([]),
  mode: text("mode").notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("asks_room_idx").on(t.roomId)]);

/** Questions a viewer sends to the owner. draft is prepared from the files; answer is what the owner sent. */
export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  visitId: text("visit_id"),
  askerName: text("asker_name"),
  text: text("text").notNull(),
  draft: text("draft"),
  draftSources: jsonb("draft_sources").$type<Source[]>().notNull().default([]),
  answer: text("answer"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
}, (t) => [index("questions_room_idx").on(t.roomId)]);
