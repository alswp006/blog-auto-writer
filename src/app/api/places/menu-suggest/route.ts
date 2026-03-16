import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";

/**
 * GET /api/places/menu-suggest?name=장소명&address=주소
 *
 * 네이버 블로그 검색 → AI 분석으로 대표 메뉴 5~6개 자동 추출
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const placeName = searchParams.get("name")?.trim();
  const address = searchParams.get("address")?.trim() ?? "";

  if (!placeName || placeName.length < 2) {
    return NextResponse.json({ error: "name required (min 2 chars)" }, { status: 400 });
  }

  const naverId = process.env.NAVER_CLIENT_ID;
  const naverSecret = process.env.NAVER_CLIENT_SECRET;
  if (!naverId || !naverSecret) {
    return NextResponse.json({ menus: [] });
  }

  try {
    // Step 1: 네이버 블로그에서 메뉴 관련 정보 검색
    const area = address.split(" ").slice(0, 2).join(" ");
    const query = area ? `${placeName} ${area} 메뉴 가격` : `${placeName} 메뉴 가격`;

    const blogRes = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=5&sort=sim`,
      {
        headers: { "X-Naver-Client-Id": naverId, "X-Naver-Client-Secret": naverSecret },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!blogRes.ok) {
      return NextResponse.json({ menus: [] });
    }

    const blogData = await blogRes.json();
    const items: { title?: string; description?: string }[] = blogData.items ?? [];

    if (items.length === 0) {
      return NextResponse.json({ menus: [] });
    }

    // 블로그 텍스트 수집 (HTML 태그 제거)
    const blogTexts = items
      .map((item) => {
        const title = (item.title ?? "").replace(/<[^>]*>/g, "");
        const desc = (item.description ?? "").replace(/<[^>]*>/g, "");
        return `${title} ${desc}`;
      })
      .join("\n");

    // Step 2: AI로 메뉴명+가격 추출
    const menus = await extractMenusWithAI(placeName, blogTexts);
    return NextResponse.json({ menus });
  } catch {
    return NextResponse.json({ menus: [] });
  }
}

type MenuSuggestion = { name: string; price: number };

async function extractMenusWithAI(placeName: string, blogText: string): Promise<MenuSuggestion[]> {
  const prompt = `아래는 "${placeName}"에 대한 블로그 리뷰 검색 결과입니다:

${blogText.slice(0, 3000)}

위 텍스트에서 이 장소의 대표 메뉴와 가격을 추출해주세요.

규칙:
- 최대 6개까지만
- 가격이 명확히 언급된 것만 포함 (추측 금지)
- 가격은 원 단위 정수 (예: 12000)
- 가격을 모르면 0으로
- 음료/디저트/사이드 포함 가능

JSON으로 응답: { "menus": [{ "name": "메뉴명", "price": 12000 }, ...] }`;

  // Gemini 우선
  if (process.env.GEMINI_API_KEY) {
    const result = await callGemini(prompt);
    if (result) return result;
  }

  // OpenAI 폴백
  if (process.env.OPENAI_API_KEY) {
    const result = await callOpenAI(prompt);
    if (result) return result;
  }

  return [];
}

function parseMenuResponse(content: string): MenuSuggestion[] {
  try {
    const cleaned = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { menus?: MenuSuggestion[] };
    return (parsed.menus ?? [])
      .filter((m) => m.name && typeof m.name === "string")
      .map((m) => ({ name: m.name.trim(), price: Math.max(0, Math.round(Number(m.price) || 0)) }))
      .slice(0, 6);
  } catch {
    return [];
  }
}

async function callGemini(prompt: string): Promise<MenuSuggestion[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const model = process.env.GEMINI_VISION_MODEL ?? "gemini-2.0-flash-lite";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 500 },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return parseMenuResponse(text);
  } catch {
    return null;
  }
}

async function callOpenAI(prompt: string): Promise<MenuSuggestion[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 500,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return parseMenuResponse(text);
  } catch {
    return null;
  }
}
