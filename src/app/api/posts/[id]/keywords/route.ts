import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 400 });
  }

  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = postModel.getById(postId);
  if (!post || post.userId !== auth.userId) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Use post content by default
  }

  const lang = (body.lang as string) ?? "ko";
  const title = lang === "ko" ? post.titleKo : post.titleEn;
  const content = lang === "ko" ? post.contentKo : post.contentEn;

  if (!title && !content) {
    return NextResponse.json({ error: "Post has no content" }, { status: 400 });
  }

  const textSnippet = [title, content?.slice(0, 1000)].filter(Boolean).join("\n\n");

  const systemPrompt = lang === "ko"
    ? "당신은 블로그 SEO 전문가입니다. 주어진 블로그 글에서 검색 유입에 효과적인 키워드를 추출합니다. 롱테일 키워드를 포함하세요. 응답은 반드시 JSON 배열로만 출력하세요."
    : "You are a blog SEO expert. Extract search-effective keywords from the given blog post. Include long-tail keywords. Respond with a JSON array only.";

  const userPrompt = lang === "ko"
    ? `다음 블로그 글에서 네이버/구글 검색 유입에 효과적인 키워드 8~12개를 추출하세요.\n해시태그 형태(#키워드)로 반환하세요.\n\n---\n${textSnippet}\n---\n\n응답 예시: ["#서울맛집", "#강남카페", "#가성비점심"]\nJSON 배열만 출력하세요.`
    : `Extract 8-12 SEO-effective keywords from this blog post.\nReturn as hashtags (#keyword).\n\n---\n${textSnippet}\n---\n\nExample: ["#seoulfood", "#koreatravel", "#budgetrestaurant"]\nJSON array only.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `OpenAI error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content ?? "[]";
    const jsonStr = rawContent.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let keywords: string[];
    try {
      keywords = JSON.parse(jsonStr);
      if (!Array.isArray(keywords)) throw new Error("Not an array");
    } catch {
      // Try to extract hashtags from text
      keywords = jsonStr.match(/#[^\s,"\]]+/g) ?? [];
    }

    // Ensure all start with #
    keywords = keywords
      .map((k: string) => (k.startsWith("#") ? k : `#${k}`))
      .slice(0, 12);

    return NextResponse.json({ keywords });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Keyword extraction failed" },
      { status: 500 },
    );
  }
}
