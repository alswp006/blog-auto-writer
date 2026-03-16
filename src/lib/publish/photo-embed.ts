/**
 * Reads local photo files and provides them as buffers for platform upload.
 * Each platform uploader calls this to get photo data, uploads to its API,
 * then replaces [PHOTO:n] markers with the platform-hosted image URLs.
 */

import { readFile } from "fs/promises";
import { resolveFilePath } from "@/lib/storage";
import type { Photo } from "@/lib/models/modelTypes";

export type PhotoBuffer = {
  orderIndex: number;
  buffer: Buffer;
  caption: string | null;
  mimeType: string;
  filename: string;
};

/**
 * Load photo files from disk into memory buffers.
 * Returns only photos that exist on disk.
 */
export async function loadPhotoBuffers(photos: Photo[]): Promise<PhotoBuffer[]> {
  const results: PhotoBuffer[] = [];

  for (const photo of photos) {
    const absPath = resolveFilePath(photo.filePath);
    if (!absPath) continue;

    try {
      const buffer = await readFile(absPath);
      const ext = photo.filePath.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
      };

      results.push({
        orderIndex: photo.orderIndex,
        buffer,
        caption: photo.caption,
        mimeType: mimeMap[ext] ?? "image/jpeg",
        filename: `photo_${photo.orderIndex}.${ext}`,
      });
    } catch {
      // Skip unreadable files
    }
  }

  return results;
}

/**
 * Replace [PHOTO:n] markers in content with platform image tags.
 * urlMap: orderIndex → uploaded URL
 */
export function embedPhotosHtml(
  content: string,
  urlMap: Map<number, { url: string; caption: string | null }>,
): string {
  return content.replace(/\[PHOTO:(\d+)\]/g, (_match, idxStr) => {
    const idx = parseInt(idxStr, 10);
    const photo = urlMap.get(idx);
    if (!photo) return "";
    const alt = photo.caption ?? `Photo ${idx}`;
    let html = `<img src="${photo.url}" alt="${alt}" style="max-width:100%;margin:12px 0;" />`;
    if (photo.caption) {
      html += `\n<p style="text-align:center;color:#888;font-size:14px;">${photo.caption}</p>`;
    }
    return html;
  });
}

export function embedPhotosMarkdown(
  content: string,
  urlMap: Map<number, { url: string; caption: string | null }>,
): string {
  return content.replace(/\[PHOTO:(\d+)\]/g, (_match, idxStr) => {
    const idx = parseInt(idxStr, 10);
    const photo = urlMap.get(idx);
    if (!photo) return "";
    const alt = photo.caption ?? `Photo ${idx}`;
    let md = `![${alt}](${photo.url})`;
    if (photo.caption) {
      md += `\n*${photo.caption}*`;
    }
    return md;
  });
}
