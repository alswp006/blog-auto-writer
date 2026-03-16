import type { PhotoBuffer } from "@/lib/publish/photo-embed";
import { embedPhotosHtml } from "@/lib/publish/photo-embed";

export type TistoryConfig = {
  accessToken: string;
  blogName: string;
};

export function getTistoryConfig(): TistoryConfig | null {
  const accessToken = process.env.TISTORY_ACCESS_TOKEN;
  const blogName = process.env.TISTORY_BLOG_NAME;
  if (!accessToken || !blogName) return null;
  return { accessToken, blogName };
}

/**
 * Upload a single photo to Tistory and return the hosted URL.
 * Tistory API: POST https://www.tistory.com/apis/post/attach
 */
async function uploadPhotoToTistory(
  config: TistoryConfig,
  photo: PhotoBuffer,
): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("access_token", config.accessToken);
    formData.append("output", "json");
    formData.append("blogName", config.blogName);
    formData.append(
      "uploadedfile",
      new Blob([new Uint8Array(photo.buffer)], { type: photo.mimeType }),
      photo.filename,
    );

    const response = await fetch("https://www.tistory.com/apis/post/attach", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.tistory?.url ?? null;
  } catch {
    return null;
  }
}

export async function publishToTistory(
  config: TistoryConfig,
  title: string,
  content: string,
  tags: string[],
  photos?: PhotoBuffer[],
): Promise<{ url: string; postId: string }> {
  // Upload photos and build URL map
  let processedContent = content;
  if (photos && photos.length > 0 && /\[PHOTO:\d+\]/.test(content)) {
    const urlMap = new Map<number, { url: string; caption: string | null }>();
    for (const photo of photos) {
      const uploadedUrl = await uploadPhotoToTistory(config, photo);
      if (uploadedUrl) {
        urlMap.set(photo.orderIndex, { url: uploadedUrl, caption: photo.caption });
      }
    }
    if (urlMap.size > 0) {
      processedContent = embedPhotosHtml(content, urlMap);
    }
  }

  // Convert remaining plain text to HTML paragraphs
  const htmlContent = processedContent
    .split("\n\n")
    .map((p) => {
      const trimmed = p.trim();
      if (trimmed.startsWith("<img ") || trimmed.startsWith("<p")) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join("\n");

  const formData = new URLSearchParams();
  formData.append("access_token", config.accessToken);
  formData.append("output", "json");
  formData.append("blogName", config.blogName);
  formData.append("title", title);
  formData.append("content", htmlContent);
  formData.append("visibility", "3"); // public
  formData.append("category", "0"); // default category
  formData.append("tag", tags.map((t) => t.replace("#", "")).join(","));

  const response = await fetch("https://www.tistory.com/apis/post/write", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Tistory API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const tistoryResponse = data.tistory;

  if (tistoryResponse?.status !== "200") {
    throw new Error(`Tistory error: ${tistoryResponse?.error_message ?? "Unknown error"}`);
  }

  return {
    postId: tistoryResponse.postId,
    url: tistoryResponse.url ?? `https://${config.blogName}.tistory.com/${tistoryResponse.postId}`,
  };
}
