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

  const prompt = `블로그 글의 제목 후보 5개를 생성해주세요.

## 장소 정보
- 장소명: ${place?.name ?? ""}
- 카테고리: ${catKo[place?.category ?? ""] ?? place?.category}

## 현재 제목
- 한국어: ${post.titleKo ?? "없음"}
- 영어: ${post.titleEn ?? "없음"}

## 본문 요약 (한국어 첫 500자)
${(post.contentKo ?? "").slice(0, 500)}

## 제목 작성 규칙
1. 각 제목은 서로 다른 스타일 템플릿을 사용하세요:
   - 숫자형: 숫자가 포함된 리스트형 (예: "3가지 이유", "5번 방문한")
   - 꿀팁형: 실용 정보를 강조 (예: "웨이팅 없이 먹는 법", "현지인만 아는 꿀팁")
   - 비포애프터형: 방문 전후 변화/반전 (예: "기대 없이 갔다가 단골 됨", "별점 3점인데 줄 선 이유")
   - 질문형: 호기심 유발하는 물음 (예: "여기가 진짜 그 맛집?", "왜 아무도 안 알려줬을까")
   - 비교형: 대상 비교/경쟁 (예: "A vs B, 승자는?", "강남 3대 브런치 비교")
2. 한국어 제목: 20~40자
3. 영어 제목: SEO에 맞게 자연스럽게
4. 현재 제목과 완전히 동일하면 안 됩니다

JSON으로 응답:
{
  "titles": [
    { "titleKo": "한국어 제목", "titleEn": "English Title", "style": "숫자형" },
    { "titleKo": "한국어 제목", "titleEn": "English Title", "style": "꿀팁형" },
    { "titleKo": "한국어 제목", "titleEn": "English Title", "style": "비포애프터형" },
    { "titleKo": "한국어 제목", "titleEn": "English Title", "style": "질문형" },
    { "titleKo": "한국어 제목", "titleEn": "English Title", "style": "비교형" }
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
