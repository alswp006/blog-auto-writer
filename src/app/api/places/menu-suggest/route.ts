import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import {
  fetchGoogleBlogUrls,
  fetchMultipleBlogContents,
  fetchNaverBlogContent,
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

    // Phase 2: 블로그 본문 크롤링 (네이버 블로그 + Tistory/WordPress 등)
    // 2a. 네이버 블로그 본문 크롤링 (모바일 URL로 변환하여 크롤)
    const naverBlogUrls = naverItems
      .filter((item) => item.link && item.link.includes("blog.naver.com"))
      .slice(0, 3);

    const naverBlogContents = await Promise.all(
      naverBlogUrls.map(async (item) => {
        const content = await fetchNaverBlogContent(item.link);
        return content
          ? { title: item.title.replace(/<[^>]*>/g, ""), content }
          : null;
      }),
    );
    const naverFullTexts = naverBlogContents.filter(
      (b): b is { title: string; content: string } => b !== null,
    );

    // 2b. Tistory/WordPress 등 크롤 가능 블로그 (네이버 + Google 결과 합산)
    const otherCrawlable: GoogleSearchResult[] = [
      ...naverItems
        .filter((item) => item.link && isCrawlableDomain(item.link))
        .map((item) => ({
          title: item.title.replace(/<[^>]*>/g, ""),
          link: item.link,
          snippet: item.description.replace(/<[^>]*>/g, ""),
        })),
      ...googleResults,
    ];
    const otherBlogContents = await fetchMultipleBlogContents(otherCrawlable);

    const allBlogContents = [...naverFullTexts, ...otherBlogContents];

    // Phase 3: 모든 텍스트 소스를 결합
    // 네이버 블로그 스니펫 (본문을 못 가져온 것만)
    const crawledNaverLinks = new Set(naverFullTexts.map((b) => b.title));
    const snippetTexts = naverItems
      .filter((item) => {
        const title = item.title.replace(/<[^>]*>/g, "");
        return !crawledNaverLinks.has(title);
      })
      .map((item) => {
        const title = item.title.replace(/<[^>]*>/g, "");
        const desc = item.description.replace(/<[^>]*>/g, "");
        return `[${title}] ${desc}`;
      })
      .join("\n");

    // Google 검색 스니펫 (크롤 불가한 것만)
    const googleSnippets = googleResults
      .filter((r) => !isCrawlableDomain(r.link) && r.snippet.length > 30)
      .slice(0, 3)
      .map((r) => `[${r.title}] ${r.snippet}`)
      .join("\n");

    // 크롤된 블로그 본문 (네이버 + 기타)
    const fullTexts = allBlogContents
      .map((b) => `[${b.title}]\n${b.content}`)
      .join("\n\n");

    // 합산 텍스트 (최대 ~6000자 — 본문이 추가되어 여유 확보)
    const combinedText = [snippetTexts, googleSnippets, fullTexts]
      .filter(Boolean)
      .join("\n\n---\n\n")
      .slice(0, 6000);

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

위 텍스트에서 **실제로 언급된** 구체적인 메뉴 항목 이름과 가격을 추출해주세요.

규칙:
- 텍스트에 실제로 적혀있는 메뉴명만 추출 (추측이나 지어내기 금지)
- "브런치", "음료", "디저트", "메인" 같은 카테고리/분류명 제외 — 주문 가능한 구체적 메뉴명만
- 최대 5개, 대표/인기 메뉴 우선
- 가격은 원 단위 정수, 모르면 0
- 여러 블로그에 공통 언급된 메뉴 우선
- 텍스트에서 구체적인 메뉴명을 찾을 수 없으면 빈 배열 반환: { "menus": [] }

JSON 형식: { "menus": [{ "name": "메뉴명", "price": 12000 }] }`;

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
  "브런치", "음료", "디저트", "메인", "사이드", "세트메뉴", "코스요리",
  "식사", "주류", "메뉴", "가격", "추천메뉴", "대표메뉴", "인기메뉴",
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
