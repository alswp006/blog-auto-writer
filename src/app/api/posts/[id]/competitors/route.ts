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

  const body = await request.json().catch(() => ({}));
  const lang = (body.lang ?? "ko") as "ko" | "en";

  const title = lang === "ko" ? post.titleKo : post.titleEn;
  const content = lang === "ko" ? post.contentKo : post.contentEn;
  const hashtags = lang === "ko" ? post.hashtagsKo : post.hashtagsEn;

  if (!content) {
    return NextResponse.json({ error: "No content to analyze" }, { status: 400 });
  }

  const place = await queryOne<{ name: string; category: string; address: string | null }>(
    "SELECT name, category, address FROM places WHERE id = ?",
    post.placeId,
  );

  const catKo: Record<string, string> = {
    restaurant: "맛집", cafe: "카페", accommodation: "숙소", attraction: "관광지",
  };

  const prompt = `당신은 네이버/구글 블로그 SEO 전문가입니다. 아래 블로그 글을 분석하고, 같은 키워드("${place?.name} ${catKo[place?.category ?? "restaurant"] ?? place?.category}")로 상위 노출되는 경쟁 블로그 글들과 비교 분석해주세요.

## 현재 글 정보
- 제목: ${title}
- 장소: ${place?.name} (${place?.category})
- 주소: ${place?.address ?? "미입력"}
- 본문 길이: ${content.length}자
- 해시태그: ${hashtags.join(", ")}
- 문단 수: ${content.split("\n\n").length}

## 현재 글 (첫 800자)
${content.slice(0, 800)}...

## 분석 요청
JSON으로 응답:
{
  "benchmarks": {
    "avgContentLength": "상위 글 평균 글자수",
    "avgPhotoCount": "상위 글 평균 사진수",
    "commonElements": ["상위 글에서 자주 포함하는 요소들"]
  },
  "missing": ["현재 글에 빠져있는 중요 요소 (구체적으로, 최대 4개)"],
  "strengths": ["현재 글의 강점 (최대 3개)"],
  "improvements": ["구체적이고 실행 가능한 개선 제안 (최대 5개)"],
  "competitiveScore": 7
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
          {
            role: "system",
            content: "블로그 SEO 전문가로서 경쟁 분석을 수행합니다. 한국 블로그(네이버, 구글) 상위 노출 패턴에 정통합니다. 항상 실용적이고 구체적인 조언을 제공하세요.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `AI error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content ?? "{}";
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      return NextResponse.json({ error: "AI 응답 파싱 실패" }, { status: 502 });
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
