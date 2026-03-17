import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import { queryOne } from "@/lib/db";

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

  if (!post.contentKo && !post.contentEn) {
    return NextResponse.json({ error: "No content to generate titles from" }, { status: 400 });
  }

  const place = await queryOne<{ name: string; category: string }>(
    "SELECT name, category FROM places WHERE id = ?",
    post.placeId,
  );

  const catKo: Record<string, string> = {
    restaurant: "맛집", cafe: "카페", accommodation: "숙소", attraction: "관광지",
  };

  const prompt = `블로그 글의 제목 후보 3개를 생성해주세요.

## 장소 정보
- 장소명: ${place?.name ?? ""}
- 카테고리: ${catKo[place?.category ?? ""] ?? place?.category}

## 현재 제목
- 한국어: ${post.titleKo ?? "없음"}
- 영어: ${post.titleEn ?? "없음"}

## 본문 요약 (한국어 첫 500자)
${(post.contentKo ?? "").slice(0, 500)}

## 제목 작성 규칙
1. 각 제목은 서로 다른 스타일이어야 합니다:
   - 스타일 A: SEO 키워드 중심 (장소명 + 카테고리 + 지역명)
   - 스타일 B: 감성/호기심 유발 (클릭을 부르는 매력적 표현)
   - 스타일 C: 구체적 정보 포함 (메뉴명, 가격, 특징 등)
2. 한국어 제목: 20~40자
3. 영어 제목: SEO에 맞게 자연스럽게
4. 현재 제목과 완전히 동일하면 안 됩니다

JSON으로 응답:
{
  "titles": [
    { "titleKo": "한국어 제목 A", "titleEn": "English Title A", "style": "SEO 키워드형" },
    { "titleKo": "한국어 제목 B", "titleEn": "English Title B", "style": "감성/호기심형" },
    { "titleKo": "한국어 제목 C", "titleEn": "English Title C", "style": "구체 정보형" }
  ]
}`;

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
          { role: "system", content: "블로그 SEO 전문가입니다. 클릭률이 높은 매력적인 제목을 만듭니다." },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `AI error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "{}";
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "AI 응답 파싱 실패" }, { status: 502 });
    }

    return NextResponse.json({ titles: result.titles ?? [] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Title generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
