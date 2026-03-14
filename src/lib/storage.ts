/**
 * File storage utilities — handles Vercel serverless vs local environments.
 *
 * Vercel serverless: `public/` is read-only, only `/tmp` is writable.
 * Local dev: `public/` is writable.
 *
 * Strategy:
 * - Write to `/tmp/uploads/` always (works in both environments)
 * - Read from `/tmp/uploads/` first, then fall back to `public/` (for pre-existing files)
 * - DB stores relative paths like `/uploads/filename.jpg`
 */

import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";

const TMP_BASE = "/tmp";
const PUBLIC_BASE = path.join(process.cwd(), "public");

/** Get the writable upload directory (creates if needed) */
export async function getUploadDir(): Promise<string> {
  const dir = path.join(TMP_BASE, "uploads");
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Resolve a relative file path (e.g. `/uploads/abc.jpg`) to an absolute path.
 * Checks /tmp first, then public/ as fallback.
 * Returns null if file doesn't exist in either location.
 */
export function resolveFilePath(relativePath: string): string | null {
  // Try /tmp first (Vercel writes go here)
  const tmpPath = path.join(TMP_BASE, relativePath);
  if (existsSync(tmpPath)) return tmpPath;

  // Fallback to public/ (local dev or pre-deployed static files)
  const publicPath = path.join(PUBLIC_BASE, relativePath);
  if (existsSync(publicPath)) return publicPath;

  return null;
}

/**
 * Get the full path for writing a new file.
 * Always writes to /tmp (writable in all environments).
 */
export function getWritePath(relativePath: string): string {
  return path.join(TMP_BASE, relativePath);
}
