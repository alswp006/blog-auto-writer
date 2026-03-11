import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = await postModel.getById(postId);
  if (!post || post.userId !== auth.userId) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const { lang, paragraphIndex, feedback } = await request.json() as {
    lang: "ko" | "en";
    paragraphIndex: number;
    feedback: string;
  };

  if (!feedback?.trim()) {
    return NextResponse.json({ error: "feedback required" }, { status: 400 });
  }

  const content = lang === "ko" ? post.contentKo : post.contentEn;
  if (!content) {
    return NextResponse.json({ error: "No content to regenerate" }, { status: 400 });
  }

  const paragraphs = content.split("\n\n");
  if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length) {
    return NextResponse.json({ error: "Invalid paragraph index" }, { status: 400 });
  }

  const target = paragraphs[paragraphIndex];
  const prev = paragraphIndex > 0 ? paragraphs[paragraphIndex - 1] : null;
  const next = paragraphIndex < paragraphs.length - 1 ? paragraphs[paragraphIndex + 1] : null;
  const langLabel = lang === "ko" ? "한국어" : "English";

  const prompt = `블로그 글의 특정 문단을 수정해야 합니다.

${prev ? `[이전 문단]\n${prev}\n` : ""}
[수정할 문단]
${target}

${next ? `[다음 문단]\n${next}\n` : ""}
[사용자 피드백]
${feedback}

위 피드백을 반영하여 [수정할 문단]만 다시 작성해주세요.
규칙:
- ${langLabel}로 작성
- 앞뒤 문단과 자연스럽게 이어지게
- 번호/글머리 기호/소제목 사용 금지
- 원래 문단과 비슷한 길이 유지
- 블로그 구어체 유지
- [PHOTO:n] 마커가 있었다면 유지
- 수정된 문단 텍스트만 출력 (따옴표나 설명 없이)`;

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
          {
            role: "system",
            content: "블로그 글의 특정 문단을 사용자 피드백에 맞게 수정하는 전문가입니다. 수정된 문단만 출력하세요.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `AI error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const revised = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!revised) {
      return NextResponse.json({ error: "Empty response" }, { status: 502 });
    }

    return NextResponse.json({ revisedParagraph: revised, paragraphIndex });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Regeneration failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
