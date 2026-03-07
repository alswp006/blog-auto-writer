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

export async function publishToWordPress(
  config: WordPressConfig,
  title: string,
  content: string,
  tags: string[],
): Promise<{ url: string; postId: number }> {
  // WordPress REST API v2: https://developer.wordpress.org/rest-api/reference/posts/
  const htmlContent = content
    .split("\n\n")
    .map((p) => `<p>${p}</p>`)
    .join("\n");

  const authHeader = `Basic ${Buffer.from(`${config.username}:${config.appPassword}`).toString("base64")}`;

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
      status: "draft", // Start as draft for safety
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
