/**
 * AI Agent Research Pipeline — AI가 자동으로 장소에 대한 리서치를 수행합니다.
 *
 * 기존 enrichment(Naver/Google 단순 검색)와 달리:
 * 1. AI가 최적의 검색 쿼리를 다수 생성
 * 2. 여러 소스에서 병렬로 데이터 수집
 * 3. AI가 수집된 데이터를 분석/요약하여 구조화된 인사이트 반환
 *
 * 결과는 블로그 프롬프트에 추가되어 더 풍부하고 정확한 글 생성에 활용됩니다.
 */

export type PlaceInsight = {
  popularMenus: string[];        // 인기 메뉴 목록
  atmosphere: string | null;     // 분위기 요약
  tips: string[];                // 방문 팁 (주차, 웨이팅, 추천 시간대 등)
  nearbyLandmarks: string[];     // 근처 랜드마크/교통
  recentTrends: string | null;   // 최근 트렌드 (신메뉴, 리모델링 등)
  visitorSentiment: string | null; // 방문자 전반 감성 요약
  bestPhotoSpots: string[];      // 사진 찍기 좋은 포인트
  rawSources: string[];          // AI 분석에 사용된 원본 텍스트 (디버깅용)
};

const EMPTY_INSIGHT: PlaceInsight = {
  popularMenus: [],
  atmosphere: null,
  tips: [],
  nearbyLandmarks: [],
  recentTrends: null,
  visitorSentiment: null,
  bestPhotoSpots: [],
  rawSources: [],
};

// ── Step 1: AI가 최적의 검색 쿼리 생성 ──

async function generateSearchQueries(
  placeName: string,
  category: string,
  address: string | null,
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // AI 없으면 기본 쿼리 패턴 사용
    const area = address?.split(" ").slice(0, 2).join(" ") ?? "";
    return [
      `${placeName} ${area} 후기`,
      `${placeName} ${area} 추천 메뉴`,
      `${placeName} 방문 팁`,
      `${placeName} 분위기`,
    ];
  }

  try {
    const prompt = `장소명: "${placeName}" (${category})
주소: ${address ?? "미상"}

이 장소에 대해 블로그 글을 쓰려고 합니다.
네이버/구글에서 검색하면 유용한 정보를 얻을 수 있는 검색 쿼리 6개를 생성해주세요.

규칙:
- 다양한 각도: 메뉴/분위기/주차/웨이팅/가성비/사진 포인트 등
- 지역명 포함하여 검색 정확도 높이기
- 최신 후기를 찾을 수 있는 쿼리 포함

JSON으로 응답: { "queries": ["쿼리1", "쿼리2", ...] }`;

    const result = await callAI(prompt, apiKey);
    if (!result) return getDefaultQueries(placeName, address);

    try {
      const parsed = JSON.parse(result) as { queries?: string[] };
      return parsed.queries?.slice(0, 6) ?? getDefaultQueries(placeName, address);
    } catch {
      return getDefaultQueries(placeName, address);
    }
  } catch {
    return getDefaultQueries(placeName, address);
  }
}

function getDefaultQueries(placeName: string, address: string | null): string[] {
  const area = address?.split(" ").slice(0, 2).join(" ") ?? "";
  return [
    `${placeName} ${area} 후기`,
    `${placeName} 추천 메뉴 가격`,
    `${placeName} 주차 웨이팅`,
    `${placeName} 분위기 인테리어`,
  ];
}

// ── Step 2: 네이버 블로그 검색으로 데이터 수집 ──

async function searchNaverBlogs(query: string): Promise<string[]> {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return [];

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=3&sort=sim`,
      {
        headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? [])
      .map((item: { title?: string; description?: string }) => {
        const title = (item.title ?? "").replace(/<[^>]*>/g, "").trim();
        const desc = (item.description ?? "").replace(/<[^>]*>/g, "").trim();
        return desc.length > 30 ? `[${title}] ${desc}` : "";
      })
      .filter((s: string) => s.length > 0);
  } catch {
    return [];
  }
}

// ── Step 3: 여러 쿼리로 병렬 검색 ──

async function fetchAllSources(queries: string[]): Promise<string[]> {
  const results = await Promise.all(queries.map((q) => searchNaverBlogs(q)));
  // 중복 제거 + 합치기
  const seen = new Set<string>();
  const combined: string[] = [];
  for (const batch of results) {
    for (const item of batch) {
      if (!seen.has(item)) {
        seen.add(item);
        combined.push(item);
      }
    }
  }
  return combined.slice(0, 15); // 최대 15개
}

// ── Step 4: AI가 수집 데이터를 분석/구조화 ──

async function analyzeAndStructure(
  placeName: string,
  category: string,
  rawData: string[],
): Promise<PlaceInsight> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || rawData.length === 0) return { ...EMPTY_INSIGHT, rawSources: rawData };

  const sourcesText = rawData.map((s, i) => `${i + 1}. ${s}`).join("\n");

  const prompt = `아래는 "${placeName}" (${category})에 대한 블로그/리뷰 검색 결과입니다:

${sourcesText}

위 데이터를 분석하여 블로그 작성에 유용한 인사이트를 추출해주세요.

JSON으로 응답:
{
  "popularMenus": ["인기메뉴1", "인기메뉴2"],
  "atmosphere": "한 줄 분위기 요약 (없으면 null)",
  "tips": ["팁1", "팁2"],
  "nearbyLandmarks": ["근처 지하철역", "랜드마크"],
  "recentTrends": "최근 변화나 트렌드 (없으면 null)",
  "visitorSentiment": "전반적 방문자 감성 요약 (없으면 null)",
  "bestPhotoSpots": ["사진 포인트1", "사진 포인트2"]
}

규칙:
- 검색 결과에 근거한 정보만 추출 (추측 금지)
- 각 필드에 해당하는 정보가 없으면 빈 배열 또는 null
- 간결하게 (각 항목 20자 이내)`;

  try {
    const result = await callAI(prompt, apiKey);
    if (!result) return { ...EMPTY_INSIGHT, rawSources: rawData };

    const parsed = JSON.parse(result) as Partial<PlaceInsight>;
    return {
      popularMenus: Array.isArray(parsed.popularMenus) ? parsed.popularMenus : [],
      atmosphere: typeof parsed.atmosphere === "string" ? parsed.atmosphere : null,
      tips: Array.isArray(parsed.tips) ? parsed.tips : [],
      nearbyLandmarks: Array.isArray(parsed.nearbyLandmarks) ? parsed.nearbyLandmarks : [],
      recentTrends: typeof parsed.recentTrends === "string" ? parsed.recentTrends : null,
      visitorSentiment: typeof parsed.visitorSentiment === "string" ? parsed.visitorSentiment : null,
      bestPhotoSpots: Array.isArray(parsed.bestPhotoSpots) ? parsed.bestPhotoSpots : [],
      rawSources: rawData,
    };
  } catch {
    return { ...EMPTY_INSIGHT, rawSources: rawData };
  }
}

// ── AI 호출 유틸리티 (OpenAI 사용 — 텍스트 작업에 Vision 모델 불필요) ──

async function callAI(prompt: string, _apiKey: string): Promise<string | null> {
  return callOpenAI(prompt);
}

async function callOpenAI(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

// ── Main export ──

/**
 * AI 에이전트 리서치: 장소에 대해 자동으로 리서치하여 구조화된 인사이트를 반환합니다.
 *
 * Pipeline:
 * 1. AI가 최적의 검색 쿼리 생성 (6개)
 * 2. 네이버 블로그에서 병렬 검색
 * 3. AI가 결과를 분석/구조화
 *
 * 모든 단계에서 실패해도 빈 결과를 반환 (generation을 블로킹하지 않음)
 */
export async function researchPlace(
  placeName: string,
  category: string,
  address: string | null,
): Promise<PlaceInsight> {
  try {
    // Step 1: AI가 검색 쿼리 생성
    const queries = await generateSearchQueries(placeName, category, address);

    // Step 2: 병렬 검색
    const rawData = await fetchAllSources(queries);

    if (rawData.length === 0) return EMPTY_INSIGHT;

    // Step 3: AI 분석/구조화
    return await analyzeAndStructure(placeName, category, rawData);
  } catch {
    return EMPTY_INSIGHT;
  }
}
