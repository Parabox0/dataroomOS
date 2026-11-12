// File storage. Local folder (./.data/files) by default.
// For hosting, point FILES_DIR at a mounted volume (Railway volume), or swap these two
// functions for Supabase Storage (see README). Nothing else in the app touches files directly.
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

const root = () => process.env.FILES_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "files");

function safe(key: string) {
  if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes("..")) throw new Error("Bad file key");
  return path.join(root(), key);
}

export async function putFile(key: string, data: Buffer | Uint8Array) {
  const p = safe(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
}

export async function getFile(key: string): Promise<Buffer> {
  return fs.readFile(safe(key));
}

export async function deleteFolder(prefix: string) {
  await fs.rm(safe(prefix), { recursive: true, force: true });
}
