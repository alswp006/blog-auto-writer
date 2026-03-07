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

export async function publishToMedium(
  config: MediumConfig,
  title: string,
  content: string,
  tags: string[],
): Promise<{ url: string; postId: string }> {
  const userId = await getMediumUserId(config.integrationToken);

  // Medium API: https://github.com/Medium/medium-api-docs
  const markdownContent = `# ${title}\n\n${content}`;

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
      publishStatus: "draft", // Start as draft for safety
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
