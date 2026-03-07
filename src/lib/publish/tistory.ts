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

export async function publishToTistory(
  config: TistoryConfig,
  title: string,
  content: string,
  tags: string[],
): Promise<{ url: string; postId: string }> {
  // Tistory Open API: https://tistory.github.io/document-tistory-apis/
  const htmlContent = content
    .split("\n\n")
    .map((p) => `<p>${p}</p>`)
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
