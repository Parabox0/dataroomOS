// Database connection.
// Default: PGlite, a real Postgres engine compiled to WebAssembly, saved in ./.data/pglite,
// so the app runs with no setup. Set DATABASE_URL to use any Postgres server instead
// (for example Supabase). The tables are the same and come from ./drizzle.
import "server-only";
import path from "node:path";
import * as schema from "./schema";
import type { PgDatabase } from "drizzle-orm/pg-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DB = PgDatabase<any, typeof schema>;

type Holder = { db?: DB; ready?: Promise<DB> };
const g = globalThis as unknown as { __dataroomDb?: Holder };
g.__dataroomDb ??= {};
const holder = g.__dataroomDb;

async function connect(): Promise<DB> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(process.env.DATABASE_URL, { prepare: false, max: Number(process.env.DATABASE_POOL_MAX) || 5 });
    const db = drizzle(client, { schema });
    if (process.env.DATAROOM_SKIP_MIGRATE !== "1") await migrate(db, { migrationsFolder });
    return db as unknown as DB;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  if (dataDir !== "memory") (await import("node:fs")).mkdirSync(dataDir, { recursive: true });
  const client = dataDir === "memory" ? new PGlite() : new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as DB;
}

/** Returns the connected, migrated database, with the sample room added when it is empty. */
export async function getDb(): Promise<DB> {
  if (holder.db) return holder.db;
  holder.ready ??= (async () => {
    const db = await connect();
    if (process.env.DATAROOM_DEMO_DATA !== "0") {
      const { seedIfEmpty } = await import("../seed");
      await seedIfEmpty(db);
    }
    holder.db = db;
    return db;
  })().catch((e) => {
    holder.ready = undefined;
    throw e;
  });
  return holder.ready;
}

export { schema };
