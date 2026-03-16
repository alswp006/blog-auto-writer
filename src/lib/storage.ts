/**
 * File storage utilities.
 *
 * UPLOAD_DIR env var controls where files are stored:
 * - Railway/Docker: set UPLOAD_DIR=/app/uploads (persistent with volume)
 * - Vercel: defaults to /tmp (ephemeral)
 * - Local dev: defaults to /tmp
 *
 * DB stores relative paths like `/uploads/filename.jpg`
 */

import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";

const STORAGE_BASE = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR, "..")  // e.g. /app if UPLOAD_DIR=/app/uploads
  : "/tmp";
const UPLOAD_SUBDIR = "uploads";
const PUBLIC_BASE = path.join(process.cwd(), "public");

/** Get the writable upload directory (creates if needed) */
export async function getUploadDir(): Promise<string> {
  const dir = process.env.UPLOAD_DIR ?? path.join(STORAGE_BASE, UPLOAD_SUBDIR);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Resolve a relative file path (e.g. `/uploads/abc.jpg`) to an absolute path.
 * Checks UPLOAD_DIR/storage base first, then /tmp, then public/.
 */
export function resolveFilePath(relativePath: string): string | null {
  // Try configured storage base
  const storagePath = path.join(STORAGE_BASE, relativePath);
  if (existsSync(storagePath)) return storagePath;

  // Try /tmp (Vercel/default)
  const tmpPath = path.join("/tmp", relativePath);
  if (existsSync(tmpPath)) return tmpPath;

  // Fallback to public/
  const publicPath = path.join(PUBLIC_BASE, relativePath);
  if (existsSync(publicPath)) return publicPath;

  return null;
}

/**
 * Get the full path for writing a new file.
 */
export function getWritePath(relativePath: string): string {
  return path.join(STORAGE_BASE, relativePath);
}
