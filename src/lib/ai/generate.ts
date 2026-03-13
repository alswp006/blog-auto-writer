import type { Place } from "@/lib/models/modelTypes";
import type { MenuItem } from "@/lib/models/modelTypes";
import type { Photo } from "@/lib/models/modelTypes";
import type { StyleProfile, UserProfile } from "@/lib/models/modelTypes";
import { enrichPlace, type EnrichedPlaceInfo } from "@/lib/ai/enrich";
import { describePhotosForGeneration, type PhotoDescription } from "@/lib/ai/photoDescribe";
import { query } from "@/lib/db";

const KRW_USD_RATE = Number(process.env.KRW_USD_RATE) || 1300;

// ── Opening pattern variation (prevents repetitive AI openings) ──

const OPENING_PATTERNS_KO = [
  "날씨/계절 묘사로 시작 (예: '바람이 선선해진 어느 가을 오후, ~')",
  "감각 묘사로 시작 — 냄새, 소리, 촉감 (예: '문을 열자마자 고소한 향이 ~')",
  "동행자와의 대화로 시작 (예: '친구가 갑자기 \"여기 꼭 가봐야 해\" 라고 ~')",
  "장소를 찾아가는 과정으로 시작 (예: '지하철에서 내려서 골목을 두 번 꺾으니 ~')",
  "의외의 발견으로 시작 (예: '사실 다른 가게를 가려다가 우연히 ~')",
  "음식/메뉴에 대한 기대로 시작 (예: '인스타에서 본 그 비주얼을 직접 보려고 ~')",
  "시간대 묘사로 시작 (예: '평일 점심시간이 살짝 지난 한적한 시간에 ~')",
  "개인적 맥락으로 시작 (예: '요즘 스트레스가 좀 쌓여서 맛있는 거라도 먹으러 ~')",
  "외관/간판 묘사로 시작 (예: '낡은 건물 사이에 눈에 띄는 초록색 간판이 ~')",
  "재방문 이유로 시작 (예: '한 번 다녀온 뒤로 자꾸 생각나서 ~')",
];

const OPENING_PATTERNS_EN = [
  "Start with the journey there (subway, walking, getting lost)",
  "Start with a sensory detail (smell, sound, crowd atmosphere)",
  "Start with the cultural context (why this place is special in Korean culture)",
  "Start with a personal anecdote (what led you here, who recommended it)",
  "Start with a surprising first impression (something unexpected)",
  "Start with the neighborhood vibe (what the area around the place feels like)",
  "Start with a comparison to something back home",
  "Start with the exterior/signage and trying to find the entrance",
];

function pickOpeningPattern(lang: "ko" | "en"): string {
  const patterns = lang === "ko" ? OPENING_PATTERNS_KO : OPENING_PATTERNS_EN;
  return patterns[Math.floor(Math.random() * patterns.length)];
}

// ── Past post retrieval for few-shot ──

type PastPostSample = { titleKo: string; contentKoExcerpt: string; titleEn: string; contentEnExcerpt: string };

async function fetchUserPastPosts(userId: number, limit: number = 2): Promise<PastPostSample[]> {
  try {
    const rows = await query<{
      title_ko: string | null;
      content_ko: string | null;
      title_en: string | null;
      content_en: string | null;
    }>(
      `SELECT title_ko, content_ko, title_en, content_en
       FROM posts
       WHERE user_id = ? AND status = 'generated' AND content_ko IS NOT NULL
       ORDER BY updated_at DESC, rowid DESC
       LIMIT ?`,
      userId, limit,
    );

    return rows
      .filter((r) => r.content_ko && r.content_ko.length > 500)
      .map((r) => ({
        titleKo: r.title_ko ?? "",
        // Take first ~800 chars at paragraph boundary
        contentKoExcerpt: truncateAtParagraph(r.content_ko ?? "", 800),
        titleEn: r.title_en ?? "",
        contentEnExcerpt: truncateAtParagraph(r.content_en ?? "", 600),
      }));
  } catch {
    return [];
  }
}

function truncateAtParagraph(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  // Strip [PHOTO:n] markers for the excerpt
  const clean = text.replace(/\[PHOTO:\d+\]\s*/g, "");
  const cut = clean.lastIndexOf("\n\n", maxLen);
  return (cut > maxLen * 0.4 ? clean.slice(0, cut) : clean.slice(0, maxLen)) + "...";
}

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
    ko: `자연스럽게 아래 내용을 녹여서 서술하세요 (번호/목록 형식 절대 금지, 소제목도 쓰지 마세요):
- 가게를 처음 발견했을 때의 첫인상과 외관 묘사
- 자리에 앉아서 메뉴를 고르는 과정, 어떤 메뉴가 눈에 들어왔는지 (가격 자연스럽게 언급)
- 음식이 나왔을 때의 비주얼 감상 (색감, 플레이팅, 양)
- 한 입 먹었을 때의 맛 표현 (식감, 온도, 향, 소스 등 구체적으로)
- 같이 간 사람과의 대화나 반응, 분위기
- 전체적인 가성비와 재방문 의사
- 위치나 찾아가는 팁`,
    en: `Weave the following naturally into a flowing narrative (NO numbered lists, NO subheadings):
- Your first impression walking up to the place
- Settling in and browsing the menu, what caught your eye (mention prices in USD, 1 USD ≈ ${KRW_USD_RATE.toLocaleString()} KRW)
- How the food looked when it arrived (colors, plating, portion size)
- Detailed taste notes — texture, temperature, sauce, seasoning
- The vibe, who you were with, the atmosphere
- Overall value and whether you'd return
- How to get there (nearest subway station and exit)`,
  },
  cafe: {
    ko: `자연스럽게 아래 내용을 녹여서 서술하세요 (번호/목록 형식 절대 금지, 소제목도 쓰지 마세요):
- 카페를 발견하게 된 계기, 외관과 간판의 느낌
- 문을 열고 들어갔을 때의 인테리어와 분위기 (조명, 음악, 좌석 배치)
- 주문한 음료와 디저트, 맛과 비주얼 감상
- 자리에 앉아서 느낀 분위기 (작업하기 좋은지, 대화하기 좋은지)
- 콘센트, 와이파이, 화장실 등 실용 정보
- 위치와 영업시간 팁`,
    en: `Weave the following naturally into a flowing narrative (NO numbered lists, NO subheadings):
- How you discovered this cafe, exterior and signage vibes
- Walking in — the interior, lighting, music, seating layout
- What you ordered (drinks & desserts with prices in USD, 1 USD ≈ ${KRW_USD_RATE.toLocaleString()} KRW) and how it tasted
- The overall atmosphere — good for working, chatting, or just chilling?
- Practical info: power outlets, WiFi, restroom
- How to get there (nearest subway station)`,
  },
  accommodation: {
    ko: `자연스럽게 아래 내용을 녹여서 서술하세요 (번호/목록 형식 절대 금지, 소제목도 쓰지 마세요):
- 숙소에 도착했을 때의 외관과 로비 첫인상
- 체크인 과정과 직원 응대
- 방에 들어갔을 때의 느낌 (침대, 어메니티, 청결도, 넓이)
- 창밖 풍경이나 뷰
- 조식이나 부대시설 이용 경험
- 총평과 다음에 올 사람을 위한 팁`,
    en: `Weave the following naturally into a flowing narrative (NO numbered lists, NO subheadings):
- Arriving at the accommodation — exterior and lobby first impressions
- The check-in experience and staff interaction
- Entering the room — bed, amenities, cleanliness, space
- The view from the window
- Breakfast or facilities you used
- Overall verdict and tips, price in USD (1 USD ≈ ${KRW_USD_RATE.toLocaleString()} KRW)`,
  },
  attraction: {
    ko: `자연스럽게 아래 내용을 녹여서 서술하세요 (번호/목록 형식 절대 금지, 소제목도 쓰지 마세요):
- 어떻게 가게 되었는지, 가는 길의 풍경
- 도착해서 본 첫 풍경과 느낌
- 둘러본 코스와 인상 깊었던 장면들
- 사진 찍기 좋았던 포인트
- 소요 시간과 체력 난이도
- 꿀팁이나 주의사항`,
    en: `Weave the following naturally into a flowing narrative (NO numbered lists, NO subheadings):
- How you got there (subway, bus) and the journey
- First impressions upon arrival
- Your route through the attraction and memorable moments
- Best photo spots you discovered
- How much time you spent and physical difficulty
- Tips for foreign visitors (English signage, admission in USD with 1 USD ≈ ${KRW_USD_RATE.toLocaleString()} KRW)`,
  },
};

// ── Few-shot style examples (one per category) ──

const CATEGORY_EXAMPLE: Record<string, { ko: string; en: string }> = {
  restaurant: {
    ko: `골목 안쪽에 자리 잡은 작은 간판을 보고 반신반의하며 들어갔는데, 문을 여는 순간 고소한 참기름 향이 확 퍼지더라고요. 2인 테이블에 앉아서 메뉴판을 펼쳤는데 생각보다 가짓수가 많지 않아서 오히려 마음이 놓였어요. 이런 집이 진짜 맛집이거든요.

갈비탕이 나오자마자 국물 색깔부터 달랐어요. 맑은데 깊은 그 느낌, 한 숟가락 떠서 호호 불어 먹으니까 입안에서 사르르 녹는 것 같았어요. 갈비 살도 젓가락으로 쏙 빠질 정도로 푹 고아져 있더라고요. 같이 간 친구가 "여기 어떻게 찾았어?" 하면서 연신 감탄하길래 괜히 뿌듯했어요.

밑반찬도 정성이 느껴졌어요. 깍두기가 딱 제가 좋아하는 아삭한 스타일이었고, 계란말이도 서비스로 나오는 건데 어떤 집 메인 메뉴보다 나은 수준이었어요. 밥을 국물에 말아 먹으니까 한 그릇이 순삭이더라고요.`,
    en: `Tucked away in a narrow alley, this place had me skeptical at first — the sign was tiny and easy to miss. But the moment I stepped inside, the rich aroma of sesame oil hit me and I knew I was in for something good. The menu was refreshingly short, which in my experience is always a promising sign.

When the galbitang arrived, the broth had that beautiful clear-yet-deeply-flavored look, and one sip confirmed it — this was the real deal. The short ribs were so tender they fell right off the bone. My friend kept asking how I found this place, clearly impressed. The side dishes were equally solid — the radish kimchi had that perfect crunch, and the egg roll was better than many restaurants' main courses.`,
  },
  cafe: {
    ko: `인스타에서 우연히 보고 찾아간 곳인데 실물이 사진보다 훨씬 분위기 있었어요. 2층 창가 자리에 앉으니까 바깥으로 은행나무가 보이는데 노란 잎이 햇빛에 반짝거리더라고요. 원목 테이블이랑 간접 조명이 은근 따뜻한 느낌을 주더라고요.

시그니처 라떼를 시켰는데 한 모금 마시니까 바닐라인 줄 알았는데 은은하게 헤이즐넛이 숨어 있는 맛이었어요. 디저트로 시킨 바스크 치즈케이크가 겉은 살짝 그을린 느낌인데 속은 크림치즈 그 자체라 커피랑 완벽 조합이었어요. 콘센트도 자리마다 있어서 작업하기에도 딱이었고, 음악 볼륨이 적당해서 대화하기도 좋았어요.`,
    en: `I stumbled upon this cafe through Instagram and it honestly looked even better in person. Sitting by the second-floor window, I had a perfect view of ginkgo trees with golden leaves catching the afternoon sunlight. The warm wood tables and soft indirect lighting gave the whole place a cozy, inviting feel.

Their signature latte surprised me — what I expected to be vanilla had this subtle hazelnut undertone. The Basque cheesecake was the real showstopper though, crispy on the outside with a molten cream-cheese center. Power outlets at every seat made it perfect for working remotely, and the music was at just the right volume for conversation.`,
  },
  accommodation: {
    ko: `체크인할 때 프론트 직원이 웰컴 드링크를 건네주면서 조식 시간이랑 루프탑 바 오픈 시간을 친절하게 안내해줬어요. 방에 들어가니까 킹사이즈 침대 베딩이 정말 뽀송한 느낌이더라고요. 창밖으로 남산타워가 살짝 보여서 괜히 기분이 좋아졌어요. 어메니티가 이솝 제품이라 향도 좋고 쓰기도 좋았어요.`,
    en: `Check-in was smooth — the front desk handed me a welcome drink and walked me through breakfast hours and rooftop bar schedule. The king-size bed had that distinctly plush hotel bedding feel. Through the window I caught a partial view of Namsan Tower, which was a nice bonus. The Aesop bathroom amenities were a pleasant surprise.`,
  },
  attraction: {
    ko: `지하철 3호선 안국역 1번 출구로 나와서 5분쯤 걸었더니 입구가 보였어요. 평일 오전이라 사람이 많지 않아서 여유롭게 둘러볼 수 있었어요. 돌담길을 따라 걷는데 바람이 시원하게 불어오더라고요. 고궁 안쪽 소나무 사이로 보이는 전각들이 진짜 그림 같았어요. 특히 향원정 쪽에서 연못에 반영되는 정자가 너무 예뻤어요.`,
    en: `From Anguk Station Exit 1, it was just a five-minute walk to the entrance. Going on a weekday morning meant barely any crowds, so I could wander freely. Walking along the stone walls with a cool breeze, I understood why this draws millions yearly. The deeper I went, the more stunning it got — traditional pavilions framed by pine trees, like something straight out of a painting.`,
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

// ── Shared context builder (place/menu/photos/memo/enriched) ──

function buildBaseContext(
  place: Place,
  menuItems: MenuItem[],
  photos: Photo[],
  userMemo: string,
  isRevisit: boolean,
  enriched: EnrichedPlaceInfo | null,
  photoDescs: PhotoDescription[] | null = null,
): string {
  let ctx = `## 장소 정보
- 이름: ${place.name}
- 카테고리: ${place.category}
- 주소: ${enriched?.roadAddress ?? place.address ?? "미입력"}
- 별점: ${place.rating ?? "미입력"}/5
${enriched?.naverCategory ? `- 네이버 분류: ${enriched.naverCategory}` : ""}
`;

  if (menuItems.length > 0) {
    ctx += `\n## 메뉴\n`;
    for (const item of menuItems) {
      ctx += `- ${item.name}: ${item.priceKrw.toLocaleString()}원 (~$${(item.priceKrw / KRW_USD_RATE).toFixed(1)})\n`;
    }
  }

  if (photos.length > 0) {
    ctx += `\n## 사진 정보 (${photos.length}장)\n`;
    ctx += `사진을 넣을 위치에 [PHOTO:인덱스] 마커를 삽입하세요 (예: [PHOTO:0], [PHOTO:1]).\n`;
    ctx += `모든 사진을 한 곳에 몰아넣지 말고, 글의 맥락에 맞게 분산 배치하세요.\n`;
    ctx += `각 사진의 상세 묘사를 참고하여 해당 사진 주변의 글을 더 구체적으로 작성하세요.\n\n`;
    for (const photo of photos) {
      const desc = photoDescs?.find((d) => d.orderIndex === photo.orderIndex);
      if (desc && desc.richDescription && desc.richDescription !== desc.caption) {
        // Rich description available from Vision API
        ctx += `- [PHOTO:${photo.orderIndex}]: ${desc.caption || "(설명 없음)"}\n  → 상세: ${desc.richDescription}\n`;
      } else {
        ctx += `- [PHOTO:${photo.orderIndex}]: ${photo.caption ?? "(설명 없음)"}\n`;
      }
    }
  }

  if (userMemo) {
    ctx += `\n## 작성자 메모\n${userMemo}\n`;
  }

  if (isRevisit) {
    ctx += `\n## 재방문 리뷰
- 이 글은 재방문 리뷰입니다. "다시 찾은", "재방문" 등의 표현을 자연스럽게 사용하세요.
`;
  }

  // Enriched blog references
  const hasExcerpts = enriched && enriched.blogExcerpts.length > 0;
  const hasFullTexts = enriched && enriched.blogFullTexts.length > 0;
  const hasKeywords = enriched && enriched.blogKeywords.length > 0;

  if (hasExcerpts || hasFullTexts || hasKeywords) {
    ctx += `\n## 참고: 다른 블로거들의 리뷰 (실제 데이터)
이 장소에 대한 다른 블로그 글을 참고하여 디테일을 풍부하게 만드세요.
단, 아래 내용을 그대로 복사하지 말고 자연스럽게 녹여서 활용하세요.
`;

    // Full blog texts (richest source — from crawled Tistory/WordPress/etc.)
    if (hasFullTexts) {
      ctx += `\n### 블로그 본문 참고 (상세)\n`;
      for (const fullText of enriched!.blogFullTexts.slice(0, 2)) {
        ctx += `---\n${fullText}\n---\n\n`;
      }
    }

    // Shorter snippets from Naver + Google (supplementary)
    if (hasExcerpts) {
      ctx += `\n### 다른 블로그 발췌 (요약)\n`;
      for (const excerpt of enriched!.blogExcerpts.slice(0, 4)) {
        ctx += `- ${excerpt}\n`;
      }
    }

    if (hasKeywords) {
      ctx += `\n### 자주 언급되는 키워드\n`;
      ctx += enriched!.blogKeywords.join(", ") + "\n";
      ctx += `→ 이 키워드들을 자연스럽게 본문에 녹여주세요 (억지로 넣지 말고 맥락에 맞을 때만)\n`;
    }

    ctx += `\n### 참고 데이터 활용 규칙 (중요!)
- 다른 블로그 내용은 "참고"일 뿐, 직접 방문한 것처럼 자연스럽게 재구성하세요
- 다른 블로그의 문장을 그대로 복사하면 안 됩니다 — 반드시 자기 표현으로 다시 쓰세요
- "다른 블로그에서 봤는데" 같은 메타 언급은 절대 하지 마세요
- 사용자가 직접 입력한 정보(메모, 메뉴, 사진 설명)가 가장 우선순위가 높습니다
- 참고 블로그에만 있고 사용자 입력에 없는 구체적 수치(가격, 시간)는 사용하지 마세요
`;
  }

  return ctx;
}

// ── Korean prompt builder ──

function buildKoreanPrompt(
  place: Place,
  menuItems: MenuItem[],
  photos: Photo[],
  style: StyleProfile,
  userProfile: UserProfile | null,
  userMemo: string,
  isRevisit: boolean,
  enriched: EnrichedPlaceInfo | null,
  photoDescs: PhotoDescription[] | null = null,
  pastPosts: PastPostSample[] = [],
  qualityFeedback: string | null = null,
): string {
  const cat = place.category;
  const structure = CATEGORY_STRUCTURE[cat] ?? CATEGORY_STRUCTURE.restaurant;
  const example = CATEGORY_EXAMPLE[cat] ?? CATEGORY_EXAMPLE.restaurant;
  const ageTone = getAgeToneInstruction(userProfile?.ageGroup ?? "30s");
  const toneDesc = style.analyzedTone;
  const openingPattern = pickOpeningPattern("ko");

  const baseCtx = buildBaseContext(place, menuItems, photos, userMemo, isRevisit, enriched, photoDescs);

  let prompt = `아래 장소 방문 경험을 바탕으로 한국어 블로그 글을 작성하세요.

${baseCtx}

## 한국어 글 작성 지침
${structure.ko}

### 참고 예시 (이런 톤과 흐름으로 작성하세요)
${example.ko}
${pastPosts.length > 0 ? `
### 이 사용자의 이전 글 (이 스타일을 따라하세요 — 가장 중요한 참고자료!)
${pastPosts.map((p, i) => `#### 이전 글 ${i + 1}: "${p.titleKo}"
${p.contentKoExcerpt}`).join("\n\n")}

→ 위 이전 글의 어투, 문장 패턴, 감정 표현 방식을 최대한 모방하세요. 이 사용자만의 고유한 글쓰기 스타일입니다.
` : ""}
### 도입부 패턴 (이번 글은 이 방식으로 시작하세요)
${openingPattern}

### 글 분량 (중요!)
- 최소 2500자, 권장 3000~4000자의 충분한 분량으로 작성하세요.
- 실제 인기 블로거의 글처럼 풍부하고 상세하게 작성하세요.
- 각 문단은 3~5문장 이상으로 충분히 서술하세요.
- 개인적인 에피소드, 감상, 디테일한 묘사를 풍부하게 넣으세요.

### 어투 스타일
${ageTone.ko}
- 문체 톤: ${toneDesc.tone ?? "casual"} / 격식: ${toneDesc.formality ?? "medium"} / 감정: ${toneDesc.emotion ?? "warm"}
${style.sampleTexts.map((s, i) => `- 문체 샘플 ${i + 1}: "${s}"`).join("\n")}

위 문체 샘플들의 어투, 문장 구조, 표현 방식을 분석하여 최대한 비슷한 스타일로 작성하세요.

### 자연스러운 블로그 글쓰기 (중요!)
- 절대 번호를 매기지 마세요 (1. 2. 3. 금지)
- 소제목(##, ###) 사용 금지 — 문단 흐름으로 자연스럽게 전환
- 구어체 사용 (블로그답게 자연스럽게)
- 문장 길이를 랜덤하게 (짧은 감탄문과 긴 서술문 섞기)
- "~인 것 같아요", "~더라고요", "~거든요" 같은 개인 경험 표현 사용
- 접속사 패턴을 다양하게 ("그래서", "근데", "아무튼", "솔직히" 등)
- 중간중간 개인 감상이나 에피소드 삽입 (예: 동행자와의 대화, 날씨, 그날의 기분)

### AI스러운 표현 금지 (절대 사용하지 마세요)
- "~을 소개해 드리겠습니다", "~에 대해 알아보겠습니다" 같은 안내형 도입부
- "첫째, 둘째, 셋째" 같은 나열식 전개
- "마지막으로", "결론적으로" 같은 딱딱한 마무리
- "~한 경험을 하게 되었습니다" 같은 수동적/간접적 표현
- "다양한", "특별한", "완벽한", "최고의" 같은 의미 없는 형용사 남발
- "그럼 지금부터", "자 그러면" 같은 방송 진행자식 표현

${isRevisit ? `### 재방문 표현
- "지난번에 왔을 때보다...", "변함없이 맛있는...", "이번에는 새로운 메뉴를..."
- 해시태그에 #재방문 반드시 포함
` : ""}

### 사진 배치 규칙
${photos.length > 0 ? `- 반드시 모든 [PHOTO:n] 마커를 본문 중 적절한 위치에 삽입하세요.
- 사진은 해당 내용을 서술한 직후에 배치하세요.
- [PHOTO:n] 마커는 반드시 독립된 줄에 단독으로 작성하세요.` : "- 사진이 없으므로 [PHOTO] 마커를 사용하지 마세요."}

### SEO 제목
- 장소명 + 카테고리 키워드 포함
- 클릭 유도하는 매력적인 제목 (20~40자)`;

  if (qualityFeedback) {
    prompt += `\n\n### ⚠️ 이전 생성 결과 품질 피드백 (반드시 반영하세요!)
${qualityFeedback}`;
  }

  prompt += `

## 글 작성 전 계획 (중요!)
글을 바로 쓰지 말고, 먼저 아래 사항을 계획한 뒤 plan 필드에 간략히 적으세요:
- 어떤 에피소드나 장면으로 도입부를 열 것인가
- 중간에 어떤 감각 묘사를 배치할 것인가
- 마무리를 어떤 느낌으로 끝낼 것인가

## 출력 형식 (JSON)
{
  "plan": "도입: ..., 중간: ..., 마무리: ... (2~3줄 요약)",
  "title": "SEO 최적화된 한국어 제목 (20~40자)",
  "content": "한국어 블로그 본문 (2500~4000자, 문단 구분은 \\n\\n, 사진 위치에 [PHOTO:n] 마커 삽입)",
  "hashtags": ["#해시태그1", "#해시태그2", "#해시태그3", "#해시태그4", "#해시태그5", "#해시태그6", "#해시태그7"]
}`;

  return prompt;
}

// ── English prompt builder ──

function buildEnglishPrompt(
  place: Place,
  menuItems: MenuItem[],
  photos: Photo[],
  style: StyleProfile,
  userProfile: UserProfile | null,
  userMemo: string,
  isRevisit: boolean,
  enriched: EnrichedPlaceInfo | null,
  photoDescs: PhotoDescription[] | null = null,
  pastPosts: PastPostSample[] = [],
  qualityFeedback: string | null = null,
): string {
  const cat = place.category;
  const structure = CATEGORY_STRUCTURE[cat] ?? CATEGORY_STRUCTURE.restaurant;
  const example = CATEGORY_EXAMPLE[cat] ?? CATEGORY_EXAMPLE.restaurant;
  const ageTone = getAgeToneInstruction(userProfile?.ageGroup ?? "30s");
  const openingPattern = pickOpeningPattern("en");

  const baseCtx = buildBaseContext(place, menuItems, photos, userMemo, isRevisit, enriched, photoDescs);

  let prompt = `Write an English blog post about this place from the perspective of a foreign tourist visiting Korea.

${baseCtx}

## CRITICAL: This is NOT a translation task
- Write an ORIGINAL English blog post — do NOT translate from Korean
- Use completely different opening, structure, and anecdotes than a Korean version would
- Write from the perspective of someone who doesn't speak Korean
- Include cultural observations that a foreigner would notice

## English Writing Guidelines
${structure.en}

### Style Example (write with this tone and flow)
${example.en}
${pastPosts.length > 0 && pastPosts.some((p) => p.contentEnExcerpt.length > 100) ? `
### This user's previous English posts (match this style!)
${pastPosts.filter((p) => p.contentEnExcerpt.length > 100).map((p, i) => `#### Previous post ${i + 1}: "${p.titleEn}"
${p.contentEnExcerpt}`).join("\n\n")}

→ Match this user's unique writing voice, sentence patterns, and expression style as closely as possible.
` : ""}
### Opening approach (start THIS post with this pattern)
${openingPattern}

### Length Requirements
- Minimum 1500 characters, recommended 2000~2500 characters
- Each paragraph should be 3~5 sentences minimum
- Include sensory details, personal reactions, and practical tips

### Tone
${ageTone.en}

### Foreign Tourist Perspective (MUST include)
- Nearest subway station and exit number (if known)
- All prices converted to USD (1 USD ≈ ${KRW_USD_RATE.toLocaleString()} KRW)
- English menu availability ("English menu available" or "Korean-only menu, but...")
- Card payment availability
- Cultural tips foreigners should know (e.g., self-service water, shoe removal, etc.)
- Navigation tips for non-Korean speakers

${isRevisit ? `### Revisit Expressions
- Use phrases like "returning to", "this time around", "compared to my last visit"
- Include #revisit in hashtags
` : ""}

### Photo Placement
${photos.length > 0 ? `- Insert ALL [PHOTO:n] markers at appropriate positions in the text.
- Place photo markers on their own line, after describing the relevant content.
- Distribute photos evenly throughout the post.` : "- No photos available — do NOT use [PHOTO] markers."}

### SEO Title
- Include place name + relevant English keywords
- Engaging, clickable title (40~80 characters)`;

  if (qualityFeedback) {
    prompt += `\n\n### ⚠️ Quality feedback from previous attempt (MUST address!)
${qualityFeedback}`;
  }

  prompt += `

## Write a brief plan first
Before writing, plan in the "plan" field:
- Opening hook / first scene
- Key sensory details to include
- Closing impression

## Output Format (JSON)
{
  "plan": "Opening: ..., Middle: ..., Closing: ... (2-3 line summary)",
  "title": "SEO optimized English title",
  "content": "English blog post (1500~2500 chars, use \\n\\n for paragraphs, insert [PHOTO:n] markers)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"]
}`;

  return prompt;
}

// ── System messages ──

const SYSTEM_MSG_KO = `당신은 한국에서 가장 인기 있는 블로거입니다. 실제 방문 경험을 생생하게 전달하는 것이 특기입니다.

작성 원칙:
- 절대 번호 매기기(1. 2. 3.)나 글머리 기호(- •)를 사용하지 마세요
- 소제목(##, ###)을 사용하지 마세요
- 모든 정보를 자연스러운 서술형 문단으로 풀어쓰세요
- 마치 친구에게 이야기하듯 생동감 있게 작성하세요
- 충분히 길고 상세하게 작성하세요 (한국어 2500자 이상)
- "소개해 드리겠습니다", "알아보겠습니다" 같은 AI스러운 표현 절대 금지
- 반드시 plan 필드를 먼저 작성한 후 그 계획에 따라 글을 쓰세요

팩트 체크 규칙 (매우 중요!):
- 제공된 정보에 없는 영업시간, 전화번호, 가격을 지어내지 마세요
- 메뉴 가격은 ## 메뉴 섹션에 있는 것만 정확히 사용하세요
- 주소는 ## 장소 정보에 있는 것을 사용하세요
- 모르는 구체적 정보(층수, 좌석수, 주차 여부 등)는 언급하지 않거나 "확인해보시길" 정도로 처리하세요`;

const SYSTEM_MSG_EN = `You are a popular travel blogger writing about places in Korea for an English-speaking audience.

Writing principles:
- NO numbered lists (1. 2. 3.), NO bullet points (- •), NO subheadings (##, ###)
- Write in flowing, narrative paragraphs — like telling a friend about your experience
- Be detailed and vivid — minimum 1500 characters
- Write from the perspective of a foreigner visiting Korea who doesn't speak Korean
- You must write the plan field FIRST, then write the post following that plan

Fact-check rules (CRITICAL):
- Do NOT invent business hours, phone numbers, or prices not in the provided data
- Use ONLY menu prices from the ## 메뉴 section
- Use the address from ## 장소 정보
- If you don't know specific details (floor count, seat count, parking), don't mention them`;

// ── OpenAI API call ──

type SingleLangResult = {
  title: string;
  content: string;
  hashtags: string[];
  plan?: string;
};

type OpenAIUsage = { model: string; inputTokens: number; outputTokens: number };

async function callOpenAISingle(
  systemMsg: string,
  prompt: string,
  apiKey: string,
): Promise<{ result: SingleLangResult; usage: OpenAIUsage | undefined }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 6144,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("AI 응답 시간이 초과되었습니다 (120초). 다시 시도해주세요.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI로부터 응답이 없습니다");

  const jsonStr = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  let parsed: SingleLangResult;
  try {
    parsed = JSON.parse(jsonStr) as SingleLangResult;
  } catch {
    throw new Error("AI 응답이 잘렸습니다. 다시 시도해주세요.");
  }

  delete parsed.plan;

  if (!parsed.title || !parsed.content) {
    throw new Error("AI 응답이 불완전합니다");
  }

  const usage = data.usage
    ? {
        model: data.model ?? "unknown",
        inputTokens: data.usage.prompt_tokens ?? 0,
        outputTokens: data.usage.completion_tokens ?? 0,
      }
    : undefined;

  return { result: parsed, usage };
}

// ── Inline quality scoring ──

type QualityIssue = { category: string; detail: string };

function quickQualityCheck(
  content: string,
  title: string,
  hashtags: string[],
  placeName: string,
  lang: "ko" | "en",
  photos: Photo[],
): { score: number; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  let score = 0;
  const maxScore = 100;

  // 1. Content length (30 pts)
  const minLen = lang === "ko" ? 2500 : 1500;
  const optLen = lang === "ko" ? 3500 : 2000;
  if (content.length >= optLen) score += 30;
  else if (content.length >= minLen) score += 20;
  else if (content.length >= minLen * 0.6) { score += 10; issues.push({ category: "분량 부족", detail: `${content.length}자 (최소 ${minLen}자 필요)` }); }
  else { score += 3; issues.push({ category: "분량 매우 부족", detail: `${content.length}자 (최소 ${minLen}자 필요)` }); }

  // 2. Paragraph structure (15 pts)
  const paragraphs = content.split("\n\n").filter((p) => p.trim().length > 0 && !p.trim().match(/^\[PHOTO:\d+\]$/));
  if (paragraphs.length >= 5) score += 15;
  else if (paragraphs.length >= 4) score += 10;
  else { score += 5; issues.push({ category: "문단 부족", detail: `${paragraphs.length}개 문단 (4개 이상 필요)` }); }

  // 3. Title quality (15 pts)
  const titleHasPlace = title.includes(placeName);
  const titleLenOk = lang === "ko" ? (title.length >= 15 && title.length <= 45) : (title.length >= 20 && title.length <= 80);
  if (titleHasPlace && titleLenOk) score += 15;
  else if (titleHasPlace) score += 10;
  else { score += 3; issues.push({ category: "제목 개선 필요", detail: titleHasPlace ? "제목 길이 조정" : `"${placeName}" 미포함` }); }

  // 4. Hashtags (10 pts)
  const tagOk = lang === "ko" ? (hashtags.length >= 5 && hashtags.length <= 10) : (hashtags.length >= 3 && hashtags.length <= 7);
  if (tagOk) score += 10;
  else if (hashtags.length > 0) score += 5;
  else { issues.push({ category: "해시태그 없음", detail: "해시태그 추가 필요" }); }

  // 5. No forbidden patterns (15 pts)
  const FORBIDDEN = lang === "ko"
    ? ["소개해 드리겠습니다", "알아보겠습니다", "살펴보겠습니다", "결론적으로", "첫째,", "둘째,"]
    : ["in conclusion", "firstly,", "secondly,", "let me introduce"];
  const hasForbidden = FORBIDDEN.some((f) => content.toLowerCase().includes(f.toLowerCase()));
  const hasHeaders = /^#{1,3}\s+/m.test(content);
  const hasNumberedList = /^\d+\.\s+/m.test(content);
  if (!hasForbidden && !hasHeaders && !hasNumberedList) score += 15;
  else { score += 5; if (hasForbidden) issues.push({ category: "AI 표현 감지", detail: "AI스러운 표현 제거 필요" }); }

  // 6. Photo markers (15 pts)
  if (photos.length === 0) {
    score += 15;
  } else {
    const usedMarkers = new Set((content.match(/\[PHOTO:\d+\]/g) ?? []).map(m => m));
    const allPresent = photos.every((p) => usedMarkers.has(`[PHOTO:${p.orderIndex}]`));
    if (allPresent) score += 15;
    else { score += 5; issues.push({ category: "사진 마커 누락", detail: `${usedMarkers.size}/${photos.length}개만 배치됨` }); }
  }

  return { score: Math.round((score / maxScore) * 100), issues };
}

function buildQualityFeedback(issues: QualityIssue[], lang: "ko" | "en"): string {
  if (lang === "ko") {
    return issues.map((i) => `- ${i.category}: ${i.detail}`).join("\n");
  }
  return issues.map((i) => `- ${i.category}: ${i.detail}`).join("\n");
}

// ── Post-processing ──

const FORBIDDEN_PHRASES_KO = [
  "소개해 드리겠습니다", "알아보겠습니다", "소개해드리겠습니다", "알아보도록",
  "살펴보겠습니다", "안내해 드리겠습니다", "함께 알아볼까요",
  "그럼 지금부터", "자 그러면", "결론적으로",
  "첫째,", "둘째,", "셋째,",
];

function postProcessSingle(content: string, photos: Photo[], lang: "ko" | "en"): string {
  // 1. Remove forbidden AI-sounding phrases (Korean)
  if (lang === "ko") {
    for (const phrase of FORBIDDEN_PHRASES_KO) {
      content = content.replace(new RegExp(phrase, "g"), "");
    }
  }

  // 2. Clean up markdown headers
  content = content.replace(/^#{1,3}\s+.+$/gm, (match) => match.replace(/^#{1,3}\s+/, ""));

  // 3. Clean up numbered lists
  content = content.replace(/^\d+\.\s+/gm, "");

  // 4. Validate photo markers
  if (photos.length > 0) {
    const used = new Set((content.match(/\[PHOTO:\d+\]/g) ?? []).map(m => m));
    for (const photo of photos) {
      const marker = `[PHOTO:${photo.orderIndex}]`;
      if (!used.has(marker)) {
        content += `\n\n${marker}`;
      }
    }
  }

  // 5. Clean double blank lines
  content = content.replace(/\n{3,}/g, "\n\n").trim();

  return content;
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

  const titleKo = isCasual ? `${place.name} 솔직 후기 | ${ck} 추천` : `${place.name} 방문 리뷰 - ${ck} 탐방기`;
  const parts: string[] = [];
  parts.push("[참고: OpenAI API 키가 설정되지 않아 기본 템플릿으로 생성되었습니다. API 키를 설정하면 AI가 더 풍부한 글을 작성합니다.]");
  if (isCasual) parts.push(`안녕하세요, ${nickname}입니다! 오늘은 ${place.name}에 다녀온 후기를 들려드릴게요.`);
  else parts.push(`${place.name}을(를) 방문한 리뷰를 작성합니다.`);
  if (place.address) parts.push(`위치는 ${place.address}에 있어요.${place.rating ? ` 개인적으로 별점 ${place.rating}점을 주고 싶습니다.` : ""}`);
  if (photos.length > 0) {
    const captions = photos.filter((p) => p.caption).map((p) => p.caption);
    if (captions.length > 0) parts.push(`사진으로 보면 ${captions.slice(0, 3).join(", ")} 이런 느낌이에요.`);
  }
  if (menuItems.length > 0) {
    const menuText = menuItems.map((m) => `${m.name}(${m.priceKrw.toLocaleString()}원)`).join(", ");
    parts.push(isCasual ? `메뉴로는 ${menuText}을(를) 시켜봤는데 다 괜찮았어요!` : `주문한 메뉴는 ${menuText}입니다.`);
  }
  if (userMemo) parts.push(userMemo);
  parts.push(isCasual ? "또 가고 싶은 곳이에요! 강추합니다 :)" : "재방문 의사가 있는 곳입니다.");

  const titleEn = `${place.name} Review | ${ce} in ${place.address?.includes("서울") ? "Seoul" : "Korea"}`;
  const enParts: string[] = [];
  enParts.push("[Note: Generated using a basic template because no OpenAI API key is configured. Set up an API key for AI-powered content.]");
  enParts.push(`I recently visited ${place.name}, a popular ${ce.toLowerCase()} in Korea.`);
  if (place.address) enParts.push(`It's located at ${place.address}.`);
  if (menuItems.length > 0) {
    const usdItems = menuItems.map((m) => `${m.name} (~$${(m.priceKrw / KRW_USD_RATE).toFixed(1)})`).join(", ");
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

// ── Quality threshold for auto-retry ──
const QUALITY_THRESHOLD = 60;

// ── Main export ──

export async function generateBlogPost(
  place: Place,
  menuItems: MenuItem[],
  photos: Photo[],
  style: StyleProfile,
  userProfile: UserProfile | null,
  userMemo: string,
  isRevisit: boolean = false,
  userId: number | null = null,
): Promise<GeneratedContent> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return generateFallback(place, menuItems, photos, style, userProfile, userMemo);
  }

  // Phase 1: Parallel data preparation
  const [enriched, photoDescs, pastPosts] = await Promise.all([
    // External data enrichment (Naver + Google)
    enrichPlace(place.name, place.address ?? null),
    // Rich photo descriptions via Vision API
    photos.length > 0 ? describePhotosForGeneration(photos) : Promise.resolve(null),
    // User's past posts for few-shot style matching
    userId ? fetchUserPastPosts(userId, 2) : Promise.resolve([]),
  ]);

  // Phase 2: Build prompts for Korean and English separately
  const koPrompt = buildKoreanPrompt(place, menuItems, photos, style, userProfile, userMemo, isRevisit, enriched, photoDescs, pastPosts);
  const enPrompt = buildEnglishPrompt(place, menuItems, photos, style, userProfile, userMemo, isRevisit, enriched, photoDescs, pastPosts);

  // Phase 3: Generate Korean and English in parallel (separate LLM calls)
  const [koResult, enResult] = await Promise.all([
    callOpenAISingle(SYSTEM_MSG_KO, koPrompt, apiKey),
    callOpenAISingle(SYSTEM_MSG_EN, enPrompt, apiKey),
  ]);

  // Post-process both
  const contentKo = postProcessSingle(koResult.result.content, photos, "ko");
  const contentEn = postProcessSingle(enResult.result.content, photos, "en");

  // Quality check both languages
  const koQuality = quickQualityCheck(contentKo, koResult.result.title, koResult.result.hashtags ?? [], place.name, "ko", photos);
  const enQuality = quickQualityCheck(contentEn, enResult.result.title, enResult.result.hashtags ?? [], place.name, "en", photos);

  // If either fails quality threshold, retry that language with feedback
  const needsKoRetry = koQuality.score < QUALITY_THRESHOLD && koQuality.issues.length > 0;
  const needsEnRetry = enQuality.score < QUALITY_THRESHOLD && enQuality.issues.length > 0;

  let finalKo = { title: koResult.result.title, content: contentKo, hashtags: koResult.result.hashtags ?? [] };
  let finalEn = { title: enResult.result.title, content: contentEn, hashtags: enResult.result.hashtags ?? [] };
  let retryKoUsage: OpenAIUsage | undefined;
  let retryEnUsage: OpenAIUsage | undefined;

  if (needsKoRetry || needsEnRetry) {
    const retries = await Promise.all([
      needsKoRetry
        ? callOpenAISingle(
            SYSTEM_MSG_KO,
            buildKoreanPrompt(place, menuItems, photos, style, userProfile, userMemo, isRevisit, enriched, photoDescs, pastPosts, buildQualityFeedback(koQuality.issues, "ko")),
            apiKey,
          )
        : null,
      needsEnRetry
        ? callOpenAISingle(
            SYSTEM_MSG_EN,
            buildEnglishPrompt(place, menuItems, photos, style, userProfile, userMemo, isRevisit, enriched, photoDescs, pastPosts, buildQualityFeedback(enQuality.issues, "en")),
            apiKey,
          )
        : null,
    ]);

    if (retries[0]) {
      const retryContent = postProcessSingle(retries[0].result.content, photos, "ko");
      const retryQuality = quickQualityCheck(retryContent, retries[0].result.title, retries[0].result.hashtags ?? [], place.name, "ko", photos);
      // Use retry only if it's actually better
      if (retryQuality.score > koQuality.score) {
        finalKo = { title: retries[0].result.title, content: retryContent, hashtags: retries[0].result.hashtags ?? [] };
      }
      retryKoUsage = retries[0].usage;
    }

    if (retries[1]) {
      const retryContent = postProcessSingle(retries[1].result.content, photos, "en");
      const retryQuality = quickQualityCheck(retryContent, retries[1].result.title, retries[1].result.hashtags ?? [], place.name, "en", photos);
      if (retryQuality.score > enQuality.score) {
        finalEn = { title: retries[1].result.title, content: retryContent, hashtags: retries[1].result.hashtags ?? [] };
      }
      retryEnUsage = retries[1].usage;
    }
  }

  // Merge usage from all calls
  const totalInput = (koResult.usage?.inputTokens ?? 0) + (enResult.usage?.inputTokens ?? 0) + (retryKoUsage?.inputTokens ?? 0) + (retryEnUsage?.inputTokens ?? 0);
  const totalOutput = (koResult.usage?.outputTokens ?? 0) + (enResult.usage?.outputTokens ?? 0) + (retryKoUsage?.outputTokens ?? 0) + (retryEnUsage?.outputTokens ?? 0);

  return {
    titleKo: finalKo.title,
    contentKo: finalKo.content,
    hashtagsKo: Array.isArray(finalKo.hashtags) ? finalKo.hashtags : [],
    titleEn: finalEn.title,
    contentEn: finalEn.content,
    hashtagsEn: Array.isArray(finalEn.hashtags) ? finalEn.hashtags : [],
    usage: {
      model: koResult.usage?.model ?? enResult.usage?.model ?? "unknown",
      inputTokens: totalInput,
      outputTokens: totalOutput,
    },
  };
}
