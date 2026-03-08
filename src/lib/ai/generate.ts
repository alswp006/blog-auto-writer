import type { Place } from "@/lib/models/modelTypes";
import type { MenuItem } from "@/lib/models/modelTypes";
import type { Photo } from "@/lib/models/modelTypes";
import type { StyleProfile, UserProfile } from "@/lib/models/modelTypes";

export type GeneratedContent = {
  titleKo: string;
  contentKo: string;
  hashtagsKo: string[];
  titleEn: string;
  contentEn: string;
  hashtagsEn: string[];
  usage?: { model: string; inputTokens: number; outputTokens: number };
};

// ── Category-specific blog structures ──

const CATEGORY_STRUCTURE: Record<string, { ko: string; en: string }> = {
  restaurant: {
    ko: `글 구조(반드시 이 순서로):
1. 외관/입구 첫인상
2. 메뉴판 소개 (가격 포함)
3. 음식 사진 묘사 (색감, 플레이팅)
4. 맛 평가 (구체적 미각 표현)
5. 가성비 총평
6. 위치/찾아가는 길`,
    en: `Blog structure (follow this order):
1. First impressions of the exterior
2. Menu overview with prices in USD (use 1 USD = 1,300 KRW)
3. Food description (colors, plating)
4. Taste review (specific flavor notes)
5. Value for money verdict
6. How to get there (nearest subway station)`,
  },
  cafe: {
    ko: `글 구조(반드시 이 순서로):
1. 외관/간판 첫인상
2. 인테리어/좌석 분위기
3. 음료/디저트 주문 및 맛
4. 분위기 (음악, 조명, 사진찍기 좋은 곳)
5. 콘센트/와이파이 여부
6. 위치/영업시간`,
    en: `Blog structure (follow this order):
1. Exterior and signage first impression
2. Interior vibes and seating
3. Drinks/desserts ordered with prices in USD (1 USD = 1,300 KRW)
4. Atmosphere (music, lighting, Instagram spots)
5. Power outlets & WiFi availability
6. How to get there (nearest subway station)`,
  },
  accommodation: {
    ko: `글 구조(반드시 이 순서로):
1. 외관/로비 첫인상
2. 체크인 과정
3. 객실 상세 (침대, 어메니티, 청결도)
4. 뷰/창밖 풍경
5. 조식/부대시설
6. 체크인 팁 및 총평`,
    en: `Blog structure (follow this order):
1. Exterior and lobby first impression
2. Check-in process
3. Room details (bed, amenities, cleanliness)
4. View from the window
5. Breakfast & facilities
6. Check-in tips and price in USD (1 USD = 1,300 KRW)`,
  },
  attraction: {
    ko: `글 구조(반드시 이 순서로):
1. 가는 방법 (대중교통)
2. 입장료/운영시간
3. 추천 코스/동선
4. 포토스팟 추천
5. 예상 소요시간
6. 꿀팁/주의사항`,
    en: `Blog structure (follow this order):
1. How to get there (nearest subway, bus)
2. Admission fee in USD (1 USD = 1,300 KRW) & hours
3. Recommended route
4. Best photo spots
5. Time needed
6. Tips for foreign visitors (English signage availability)`,
  },
};

// ── Age-based tone instructions ──

function getAgeToneInstruction(ageGroup: string): { ko: string; en: string } {
  switch (ageGroup) {
    case "20s":
      return {
        ko: "20대 어투: 이모지 자연스럽게 섞기, ㅋㅋ/ㅎㅎ 가끔 사용, '진짜' '대박' '미쳤다' 같은 감탄사, 짧은 문장 위주, 솔직한 리액션",
        en: "Write like a 20-something traveler: use casual exclamations, short punchy sentences, genuine excitement",
      };
    case "30s":
      return {
        ko: "30대 어투: 친근하지만 정돈된 말투, '~했어요' 체, 구체적인 비교('다른 곳보다 ~'), 실용적 정보 강조, 이모지 최소",
        en: "Write like a 30-something professional: friendly but organized, practical details, comparisons to alternatives",
      };
    case "40plus":
    default:
      return {
        ko: "40대+ 어투: 차분하고 신뢰감 있는 톤, '~합니다/했습니다' 체도 자연스럽게 혼용, 디테일한 관찰, 가격 대비 가치 분석, 이모지 사용 자제",
        en: "Write like a seasoned reviewer: calm, authoritative tone, detailed observations, value analysis",
      };
  }
}

// ── Build the full prompt ──

function buildPrompt(
  place: Place,
  menuItems: MenuItem[],
  photos: Photo[],
  style: StyleProfile,
  userProfile: UserProfile | null,
  userMemo: string,
  isRevisit: boolean = false,
): string {
  const cat = place.category;
  const structure = CATEGORY_STRUCTURE[cat] ?? CATEGORY_STRUCTURE.restaurant;
  const ageTone = getAgeToneInstruction(userProfile?.ageGroup ?? "30s");
  const toneDesc = style.analyzedTone;

  let prompt = `당신은 한국의 인기 블로거입니다. 아래 장소 방문 경험을 바탕으로 한국어 블로그 글과 영어 블로그 글을 각각 작성하세요.

## 장소 정보
- 이름: ${place.name}
- 카테고리: ${cat}
- 주소: ${place.address ?? "미입력"}
- 별점: ${place.rating ?? "미입력"}/5
`;

  if (menuItems.length > 0) {
    prompt += `\n## 메뉴\n`;
    for (const item of menuItems) {
      prompt += `- ${item.name}: ${item.priceKrw.toLocaleString()}원 (~$${(item.priceKrw / 1300).toFixed(1)})\n`;
    }
  }

  if (photos.length > 0) {
    prompt += `\n## 사진 설명 (${photos.length}장)\n`;
    for (const photo of photos) {
      prompt += `- 사진 ${photo.orderIndex}: ${photo.caption ?? "(설명 없음)"}\n`;
    }
  }

  if (userMemo) {
    prompt += `\n## 작성자 메모\n${userMemo}\n`;
  }

  if (isRevisit) {
    prompt += `\n## 재방문 리뷰
- 이 글은 재방문 리뷰입니다. "다시 찾은", "재방문" 등의 표현을 자연스럽게 사용하세요.
- 한국어: 이전 방문과 비교하는 느낌을 살려주세요 (예: "지난번에 왔을 때보다...", "변함없이 맛있는...", "이번에는 새로운 메뉴를...")
- 영어: Use phrases like "returning to", "this time around", "compared to my last visit"
- 한국어 해시태그에 #재방문 을 반드시 포함하세요
- 영어 해시태그에 #revisit 을 반드시 포함하세요
`;
  }

  prompt += `
## 한국어 글 작성 지침
${structure.ko}

### 어투 스타일
${ageTone.ko}
- 문체 톤: ${toneDesc.tone ?? "casual"} / 격식: ${toneDesc.formality ?? "medium"} / 감정: ${toneDesc.emotion ?? "warm"}
${style.sampleTexts.length > 0 ? `- 문체 샘플 참고: "${style.sampleTexts[0]}"` : ""}

### AI 감지 회피 (중요!)
- 구어체 사용 (블로그답게 자연스럽게)
- 문장 길이를 랜덤하게 (짧은 문장과 긴 문장 섞기)
- "~인 것 같아요", "~더라고요", "~거든요" 같은 개인 경험 표현 사용
- 접속사 패턴을 다양하게 ("그래서", "근데", "아무튼", "솔직히" 등)
- 완벽한 문법보다 자연스러운 구어 표현 우선
- 중간중간 개인 감상이나 에피소드 삽입

### SEO 제목
- 장소명 + 카테고리 키워드 포함
- 클릭 유도하는 매력적인 제목 (20~40자)

## 영어 글 작성 지침
영어 글은 한국어를 번역하지 말고, 한국을 방문한 외국인 관점에서 완전히 새로 작성하세요.
${structure.en}

### 외국인 관점 필수 포함 사항
- 가장 가까운 지하철역 및 출구 번호 (알고 있다면)
- 가격은 모두 달러로 환산 (1 USD = 1,300 KRW 고정환율)
- 영어 메뉴 유무 ("English menu available" 또는 "Korean-only menu, but...")
- 카드 결제 가능 여부
- 외국인이 알면 좋은 팁 (예: 물은 셀프, 신발 벗는 곳 등)

## 출력 형식
반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만):
{
  "titleKo": "SEO 최적화된 한국어 제목 (20~40자)",
  "contentKo": "한국어 블로그 본문 (800~1500자, 문단 구분은 \\n\\n)",
  "hashtagsKo": ["#해시태그1", "#해시태그2", "#해시태그3", "#해시태그4", "#해시태그5", "#해시태그6", "#해시태그7"],
  "titleEn": "SEO optimized English title",
  "contentEn": "English blog post (500~1000 chars, use \\n\\n for paragraphs)",
  "hashtagsEn": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"]
}`;

  return prompt;
}

// ── Fallback (no OpenAI key) ──

function generateFallback(
  place: Place,
  menuItems: MenuItem[],
  photos: Photo[],
  style: StyleProfile,
  userProfile: UserProfile | null,
  userMemo: string,
): GeneratedContent {
  const isCasual = style.analyzedTone.tone === "casual" || style.analyzedTone.formality === "low";
  const catKo: Record<string, string> = { restaurant: "맛집", cafe: "카페", accommodation: "숙소", attraction: "여행지" };
  const catEn: Record<string, string> = { restaurant: "Restaurant", cafe: "Cafe", accommodation: "Hotel", attraction: "Attraction" };
  const ck = catKo[place.category] ?? place.category;
  const ce = catEn[place.category] ?? place.category;
  const nickname = userProfile?.nickname ?? "나";

  // Korean
  const titleKo = isCasual
    ? `${place.name} 솔직 후기 | ${ck} 추천`
    : `${place.name} 방문 리뷰 - ${ck} 탐방기`;

  const parts: string[] = [];

  if (isCasual) {
    parts.push(`안녕하세요, ${nickname}입니다! 오늘은 ${place.name}에 다녀온 후기를 들려드릴게요.`);
  } else {
    parts.push(`${place.name}을(를) 방문한 리뷰를 작성합니다.`);
  }

  if (place.address) {
    parts.push(`위치는 ${place.address}에 있어요.${place.rating ? ` 개인적으로 별점 ${place.rating}점을 주고 싶습니다.` : ""}`);
  }

  if (photos.length > 0) {
    const captions = photos.filter((p) => p.caption).map((p) => p.caption);
    if (captions.length > 0) {
      parts.push(`사진으로 보면 ${captions.slice(0, 3).join(", ")} 이런 느낌이에요.`);
    }
  }

  if (menuItems.length > 0) {
    const menuText = menuItems.map((m) => `${m.name}(${m.priceKrw.toLocaleString()}원)`).join(", ");
    parts.push(isCasual
      ? `메뉴로는 ${menuText}을(를) 시켜봤는데 다 괜찮았어요!`
      : `주문한 메뉴는 ${menuText}입니다.`);
  }

  if (userMemo) parts.push(userMemo);

  parts.push(isCasual
    ? "또 가고 싶은 곳이에요! 강추합니다 :)"
    : "재방문 의사가 있는 곳입니다.");

  // English (foreigner perspective)
  const titleEn = `${place.name} Review | ${ce} in ${place.address?.includes("서울") ? "Seoul" : "Korea"}`;
  const enParts: string[] = [];
  enParts.push(`I recently visited ${place.name}, a popular ${ce.toLowerCase()} in Korea.`);
  if (place.address) enParts.push(`It's located at ${place.address}.`);
  if (menuItems.length > 0) {
    const usdItems = menuItems.map((m) => `${m.name} (~$${(m.priceKrw / 1300).toFixed(1)})`).join(", ");
    enParts.push(`We tried ${usdItems}.`);
  }
  if (place.rating) enParts.push(`I'd give it a ${place.rating}/5.`);
  enParts.push("Definitely worth checking out if you're in the area. Highly recommended for tourists!");

  return {
    titleKo,
    contentKo: parts.join("\n\n"),
    hashtagsKo: [`#${place.name}`, `#${ck}`, `#${ck}추천`, "#맛집탐방", "#블로그", "#일상", "#리뷰"],
    titleEn,
    contentEn: enParts.join("\n\n"),
    hashtagsEn: [`#${place.name.replace(/\s+/g, "")}`, `#Korea${ce}`, "#SeoulFood", "#KoreaTravel", "#TravelReview"],
  };
}

// ── OpenAI call with retry ──

async function callOpenAI(prompt: string, apiKey: string): Promise<GeneratedContent> {
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
          content: "당신은 전문 한국어/영어 이중언어 블로거입니다. 항상 유효한 JSON으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만 출력하세요.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI로부터 응답이 없습니다");

  const jsonStr = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  let parsed: GeneratedContent;
  try {
    parsed = JSON.parse(jsonStr) as GeneratedContent;
  } catch {
    // Response was likely truncated by max_tokens
    throw new Error("AI 응답이 잘렸습니다. 다시 시도해주세요.");
  }

  if (!parsed.titleKo || !parsed.contentKo || !parsed.titleEn || !parsed.contentEn) {
    throw new Error("AI 응답이 불완전합니다");
  }

  const usageData = data.usage
    ? {
        model: data.model ?? "unknown",
        inputTokens: data.usage.prompt_tokens ?? 0,
        outputTokens: data.usage.completion_tokens ?? 0,
      }
    : undefined;

  return {
    titleKo: parsed.titleKo,
    contentKo: parsed.contentKo,
    hashtagsKo: Array.isArray(parsed.hashtagsKo) ? parsed.hashtagsKo : [],
    titleEn: parsed.titleEn,
    contentEn: parsed.contentEn,
    hashtagsEn: Array.isArray(parsed.hashtagsEn) ? parsed.hashtagsEn : [],
    usage: usageData,
  };
}

// ── Main export ──

export async function generateBlogPost(
  place: Place,
  menuItems: MenuItem[],
  photos: Photo[],
  style: StyleProfile,
  userProfile: UserProfile | null,
  userMemo: string,
  isRevisit: boolean = false,
): Promise<GeneratedContent> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return generateFallback(place, menuItems, photos, style, userProfile, userMemo);
  }

  const prompt = buildPrompt(place, menuItems, photos, style, userProfile, userMemo, isRevisit);

  // Try once, retry once on failure
  try {
    return await callOpenAI(prompt, apiKey);
  } catch (firstError) {
    // Auto-retry once
    try {
      return await callOpenAI(prompt, apiKey);
    } catch (retryError) {
      throw retryError;
    }
  }
}
