import type { PhotoBuffer } from "@/lib/publish/photo-embed";
import { embedPhotosHtml } from "@/lib/publish/photo-embed";

export type WordPressConfig = {
  siteUrl: string;
  username: string;
  appPassword: string;
};

export function getWordPressConfig(): WordPressConfig | null {
  const siteUrl = process.env.WORDPRESS_URL;
  const username = process.env.WORDPRESS_USERNAME;
  const appPassword = process.env.WORDPRESS_APP_PASSWORD;
  if (!siteUrl || !username || !appPassword) return null;
  return { siteUrl: siteUrl.replace(/\/+$/, ""), username, appPassword };
}

/**
 * Upload a single photo to WordPress media library and return the source URL.
 * WordPress REST API: POST {siteUrl}/wp-json/wp/v2/media
 */
async function uploadPhotoToWordPress(
  config: WordPressConfig,
  photo: PhotoBuffer,
): Promise<string | null> {
  const authHeader = `Basic ${Buffer.from(`${config.username}:${config.appPassword}`).toString("base64")}`;

  try {
    const response = await fetch(`${config.siteUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Disposition": `attachment; filename="${photo.filename}"`,
        "Content-Type": photo.mimeType,
      },
      body: new Uint8Array(photo.buffer),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.source_url ?? null;
  } catch {
    return null;
  }
}

export async function publishToWordPress(
  config: WordPressConfig,
  title: string,
  content: string,
  tags: string[],
  photos?: PhotoBuffer[],
): Promise<{ url: string; postId: number }> {
  const authHeader = `Basic ${Buffer.from(`${config.username}:${config.appPassword}`).toString("base64")}`;

  // Upload photos and embed in content
  let processedContent = content;
  if (photos && photos.length > 0 && /\[PHOTO:\d+\]/.test(content)) {
    const urlMap = new Map<number, { url: string; caption: string | null }>();
    for (const photo of photos) {
      const uploadedUrl = await uploadPhotoToWordPress(config, photo);
      if (uploadedUrl) {
        urlMap.set(photo.orderIndex, { url: uploadedUrl, caption: photo.caption });
      }
    }
    if (urlMap.size > 0) {
      processedContent = embedPhotosHtml(content, urlMap);
    }
  }

  // Convert to HTML paragraphs (skip already-HTML parts)
  const htmlContent = processedContent
    .split("\n\n")
    .map((p) => {
      const trimmed = p.trim();
      if (trimmed.startsWith("<img ") || trimmed.startsWith("<p")) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join("\n");

  // Create or get tags
  const tagIds: number[] = [];
  for (const tag of tags.slice(0, 10)) {
    const cleanTag = tag.replace("#", "").trim();
    if (!cleanTag) continue;
    try {
      const tagRes = await fetch(`${config.siteUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(cleanTag)}`, {
        headers: { Authorization: authHeader },
      });
      const existingTags = await tagRes.json();
      if (Array.isArray(existingTags) && existingTags.length > 0) {
        tagIds.push(existingTags[0].id);
      } else {
        const createRes = await fetch(`${config.siteUrl}/wp-json/wp/v2/tags`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ name: cleanTag }),
        });
        if (createRes.ok) {
          const newTag = await createRes.json();
          tagIds.push(newTag.id);
        }
      }
    } catch {
      // Skip tag creation errors
    }
  }

  const response = await fetch(`${config.siteUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      content: htmlContent,
      status: "draft",
      tags: tagIds,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`WordPress API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return {
    postId: data.id,
    url: data.link ?? `${config.siteUrl}/?p=${data.id}`,
  };
}
