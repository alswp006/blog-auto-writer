import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import {
  fetchGoogleBlogUrls,
  fetchMultipleBlogContents,
  isCrawlableDomain,
  type GoogleSearchResult,
} from "@/lib/ai/enrich";

/**
 * GET /api/places/menu-suggest?name=장소명&address=주소
 *
 * 네이버 블로그 스니펫 + Google CSE + 블로그 본문 크롤링 → AI 분석으로 대표 메뉴 2~5개 자동 추출
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

  try {
    // Phase 1: 네이버 블로그 검색 + Google CSE 병렬 수행
    const area = address.split(" ").slice(0, 2).join(" ");
    const naverQuery = area ? `${placeName} ${area} 메뉴 가격` : `${placeName} 메뉴 가격`;

    const [naverItems, googleResults] = await Promise.all([
      naverId && naverSecret
        ? fetchNaverBlogItems(naverQuery, naverId, naverSecret)
        : Promise.resolve([]),
      fetchGoogleBlogUrls(placeName, address || null),
    ]);

    if (naverItems.length === 0 && googleResults.length === 0) {
      return NextResponse.json({ menus: [] });
    }

    // Phase 2: 크롤 가능한 블로그 본문 가져오기
    // 네이버 블로그 link 중 크롤 가능한 것 + Google 결과를 합쳐서 크롤링
    const naverCrawlable: GoogleSearchResult[] = naverItems
      .filter((item) => item.link && isCrawlableDomain(item.link))
      .map((item) => ({
        title: item.title.replace(/<[^>]*>/g, ""),
        link: item.link,
        snippet: item.description.replace(/<[^>]*>/g, ""),
      }));

    const allCrawlTargets: GoogleSearchResult[] = [...naverCrawlable, ...googleResults];
    const blogContents = await fetchMultipleBlogContents(allCrawlTargets);

    // Phase 3: 모든 텍스트 소스를 결합
    // 네이버 블로그 스니펫
    const snippetTexts = naverItems
      .map((item) => {
        const title = item.title.replace(/<[^>]*>/g, "");
        const desc = item.description.replace(/<[^>]*>/g, "");
        return `[${title}] ${desc}`;
      })
      .join("\n");

    // Google 검색 스니펫 (크롤 불가한 것만 — 크롤된 건 본문이 있으므로)
    const googleSnippets = googleResults
      .filter((r) => !isCrawlableDomain(r.link) && r.snippet.length > 30)
      .slice(0, 3)
      .map((r) => `[${r.title}] ${r.snippet}`)
      .join("\n");

    // 크롤된 블로그 본문
    const fullTexts = blogContents
      .map((b) => `[${b.title}]\n${b.content}`)
      .join("\n\n");

    // 합산 텍스트 (최대 ~5000자)
    const combinedText = [snippetTexts, googleSnippets, fullTexts]
      .filter(Boolean)
      .join("\n\n---\n\n")
      .slice(0, 5000);

    // Phase 4: AI로 메뉴명+가격 추출
    const menus = await extractMenusWithAI(placeName, combinedText);
    return NextResponse.json({ menus });
  } catch {
    return NextResponse.json({ menus: [] });
  }
}

// ── Naver blog search ──

type NaverBlogItem = {
  title: string;
  link: string;
  description: string;
};

async function fetchNaverBlogItems(
  query: string,
  naverId: string,
  naverSecret: string,
): Promise<NaverBlogItem[]> {
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=5&sort=sim`,
      {
        headers: { "X-Naver-Client-Id": naverId, "X-Naver-Client-Secret": naverSecret },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map((item: { title?: string; link?: string; description?: string }) => ({
      title: item.title ?? "",
      link: item.link ?? "",
      description: item.description ?? "",
    }));
  } catch {
    return [];
  }
}

// ── AI extraction ──

type MenuSuggestion = { name: string; price: number };

async function extractMenusWithAI(placeName: string, blogText: string): Promise<MenuSuggestion[]> {
  const prompt = `아래는 "${placeName}"에 대한 블로그 리뷰와 검색 결과입니다:

${blogText}

위 텍스트에서 이 장소에서 실제로 판매하는 **구체적인 메뉴 항목**의 이름과 가격을 추출해주세요.

규칙:
- 최소 2개, 최대 5개 추출
- 반드시 **구체적인 메뉴 이름**을 추출할 것 (예: "아메리카노", "마르게리타 피자", "숯불갈비", "크로플")
- **절대 금지**: "브런치", "음료", "디저트", "메인", "사이드", "세트메뉴", "코스요리" 같은 카테고리/분류명은 메뉴가 아님
- 대표/시그니처/인기 메뉴를 우선 (사이드메뉴·음료보다 메인 메뉴 우선)
- 가격은 원 단위 정수 (예: 12000)
- 가격을 확인할 수 없으면 0으로
- 같은 메뉴가 여러 블로그에 언급되면 신뢰도가 높으므로 우선 포함
- 텍스트에서 구체적인 메뉴명을 찾을 수 없으면 빈 배열 반환

JSON으로 응답: { "menus": [{ "name": "아메리카노", "price": 5000 }, { "name": "크로플", "price": 8500 }] }`;

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

/** Category/generic names that should never be returned as menu items */
const BLOCKED_NAMES = new Set([
  "브런치", "음료", "디저트", "메인", "사이드", "세트메뉴", "코스요리", "코스",
  "식사", "주류", "안주", "반찬", "전채", "샐러드", "스프", "빵", "커피",
  "전체메뉴", "대표메뉴", "시그니처", "추천메뉴", "인기메뉴", "신메뉴",
  "런치", "디너", "조식", "중식", "석식", "메뉴", "가격",
  "음식", "요리", "식단", "한식", "양식", "중식", "일식",
]);

function parseMenuResponse(content: string): MenuSuggestion[] {
  try {
    const cleaned = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { menus?: MenuSuggestion[] };
    return (parsed.menus ?? [])
      .filter((m) => m.name && typeof m.name === "string")
      .map((m) => ({ name: m.name.trim(), price: Math.max(0, Math.round(Number(m.price) || 0)) }))
      .filter((m) => m.name.length >= 2 && !BLOCKED_NAMES.has(m.name))
      .slice(0, 5);
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
