import type { PhotoBuffer } from "@/lib/publish/photo-embed";
import { embedPhotosMarkdown } from "@/lib/publish/photo-embed";

export type MediumConfig = {
  integrationToken: string;
};

export function getMediumConfig(): MediumConfig | null {
  const integrationToken = process.env.MEDIUM_INTEGRATION_TOKEN;
  if (!integrationToken) return null;
  return { integrationToken };
}

async function getMediumUserId(token: string): Promise<string> {
  const response = await fetch("https://api.medium.com/v1/me", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Medium API error (get user): ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.data.id;
}

/**
 * Upload a single image to Medium and return the hosted URL.
 * Medium API: POST https://api.medium.com/v1/images
 */
async function uploadPhotoToMedium(
  token: string,
  photo: PhotoBuffer,
): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append(
      "image",
      new Blob([new Uint8Array(photo.buffer)], { type: photo.mimeType }),
      photo.filename,
    );

    const response = await fetch("https://api.medium.com/v1/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.url ?? null;
  } catch {
    return null;
  }
}

export async function publishToMedium(
  config: MediumConfig,
  title: string,
  content: string,
  tags: string[],
  photos?: PhotoBuffer[],
): Promise<{ url: string; postId: string }> {
  const userId = await getMediumUserId(config.integrationToken);

  // Upload photos and embed in content
  let processedContent = content;
  if (photos && photos.length > 0 && /\[PHOTO:\d+\]/.test(content)) {
    const urlMap = new Map<number, { url: string; caption: string | null }>();
    for (const photo of photos) {
      const uploadedUrl = await uploadPhotoToMedium(config.integrationToken, photo);
      if (uploadedUrl) {
        urlMap.set(photo.orderIndex, { url: uploadedUrl, caption: photo.caption });
      }
    }
    if (urlMap.size > 0) {
      processedContent = embedPhotosMarkdown(content, urlMap);
    }
  }

  const markdownContent = `# ${title}\n\n${processedContent}`;

  const response = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.integrationToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      contentFormat: "markdown",
      content: markdownContent,
      tags: tags.slice(0, 5).map((t) => t.replace("#", "")),
      publishStatus: "draft",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Medium API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return {
    postId: data.data.id,
    url: data.data.url,
  };
}
