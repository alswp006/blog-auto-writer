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
- Settling in and browsing the menu, what caught your eye (mention prices in USD, 1 USD = 1,300 KRW)
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
- What you ordered (drinks & desserts with prices in USD, 1 USD = 1,300 KRW) and how it tasted
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
- Overall verdict and tips, price in USD (1 USD = 1,300 KRW)`,
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
- Tips for foreign visitors (English signage, admission in USD with 1 USD = 1,300 KRW)`,
  },
};

// ── Few-shot style examples (one per category) ──

const CATEGORY_EXAMPLE: Record<string, { ko: string; en: string }> = {
  restaurant: {
    ko: `골목 안쪽에 자리 잡은 작은 간판을 보고 반신반의하며 들어갔는데, 문을 여는 순간 고소한 참기름 향이 확 퍼지더라고요. 2인 테이블에 앉아서 메뉴판을 펼쳤는데 생각보다 가짓수가 많지 않아서 오히려 마음이 놓였어요. 이런 집이 진짜 맛집이거든요. 갈비탕이 나오자마자 국물 색깔부터 달랐어요. 맑은데 깊은 그 느낌, 한 숟가락 떠서 호호 불어 먹으니까 입안에서 사르르 녹는 것 같았어요.`,
    en: `Tucked away in a narrow alley, this place had me skeptical at first — the sign was tiny and easy to miss. But the moment I stepped inside, the rich aroma of sesame oil hit me and I knew I was in for something good. The menu was refreshingly short, which in my experience is always a promising sign. When the galbitang arrived, the broth had that beautiful clear-yet-deeply-flavored look, and one sip confirmed it — this was the real deal.`,
  },
  cafe: {
    ko: `인스타에서 우연히 보고 찾아간 곳인데 실물이 사진보다 훨씬 분위기 있었어요. 2층 창가 자리에 앉으니까 바깥으로 은행나무가 보이는데 노란 잎이 햇빛에 반짝거리더라고요. 시그니처 라떼를 시켰는데 한 모금 마시니까 바닐라인 줄 알았는데 은은하게 헤이즐넛이 숨어 있는 맛이었어요. 콘센트도 자리마다 있어서 작업하기에도 딱이었어요.`,
    en: `I stumbled upon this cafe through Instagram and it honestly looked even better in person. Sitting by the second-floor window, I had a perfect view of ginkgo trees with golden leaves catching the afternoon sunlight. Their signature latte surprised me — what I expected to be vanilla had this subtle hazelnut undertone. Power outlets at every seat made it perfect for working remotely too.`,
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
  const example = CATEGORY_EXAMPLE[cat] ?? CATEGORY_EXAMPLE.restaurant;
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
    prompt += `\n## 사진 정보 (${photos.length}장)\n`;
    prompt += `아래 사진들을 글의 흐름에 맞는 위치에 자연스럽게 배치하세요.\n`;
    prompt += `사진을 넣을 위치에 [PHOTO:인덱스] 마커를 삽입하세요 (예: [PHOTO:0], [PHOTO:1]).\n`;
    prompt += `모든 사진을 한 곳에 몰아넣지 말고, 글의 맥락에 맞게 분산 배치하세요.\n\n`;
    for (const photo of photos) {
      prompt += `- [PHOTO:${photo.orderIndex}]: ${photo.caption ?? "(설명 없음)"}\n`;
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

### 참고 예시 (이런 톤과 흐름으로 작성하세요)
${example.ko}

### 글 분량 (중요!)
- 최소 2500자, 권장 3000~4000자의 충분한 분량으로 작성하세요.
- 실제 인기 블로거의 글처럼 풍부하고 상세하게 작성하세요.
- 각 문단은 3~5문장 이상으로 충분히 서술하세요.
- 개인적인 에피소드, 감상, 디테일한 묘사를 풍부하게 넣으세요.

### 어투 스타일
${ageTone.ko}
- 문체 톤: ${toneDesc.tone ?? "casual"} / 격식: ${toneDesc.formality ?? "medium"} / 감정: ${toneDesc.emotion ?? "warm"}
${style.sampleTexts.slice(0, 3).map((s, i) => `- 문체 샘플 ${i + 1}: "${s}"`).join("\n")}

### 자연스러운 블로그 글쓰기 (중요!)
- 절대 번호를 매기지 마세요 (1. 2. 3. 금지)
- 소제목(##, ###) 사용 금지 — 문단 흐름으로 자연스럽게 전환
- 구어체 사용 (블로그답게 자연스럽게)
- 문장 길이를 랜덤하게 (짧은 감탄문과 긴 서술문 섞기)
- "~인 것 같아요", "~더라고요", "~거든요" 같은 개인 경험 표현 사용
- 접속사 패턴을 다양하게 ("그래서", "근데", "아무튼", "솔직히" 등)
- 완벽한 문법보다 자연스러운 구어 표현 우선
- 중간중간 개인 감상이나 에피소드 삽입 (예: 동행자와의 대화, 날씨, 그날의 기분)
- 마치 친구에게 이야기하듯 편하게 써주세요

### AI스러운 표현 금지 (절대 사용하지 마세요)
- "~을 소개해 드리겠습니다", "~에 대해 알아보겠습니다" 같은 안내형 도입부
- "첫째, 둘째, 셋째" 같은 나열식 전개
- "마지막으로", "결론적으로" 같은 딱딱한 마무리
- "~한 경험을 하게 되었습니다" 같은 수동적/간접적 표현
- 한 문단 안에서 "~요"와 "~습니다"를 무분별하게 혼용
- "다양한", "특별한", "완벽한", "최고의" 같은 의미 없는 형용사 남발
- "그럼 지금부터", "자 그러면" 같은 방송 진행자식 표현

### SEO 제목
- 장소명 + 카테고리 키워드 포함
- 클릭 유도하는 매력적인 제목 (20~40자)

## 영어 글 작성 지침
영어 글은 한국어를 번역하지 말고, 한국을 방문한 외국인 관점에서 완전히 새로 작성하세요.
${structure.en}

### English Style Example (write with this tone and flow)
${example.en}

### 영어 글 분량
- 최소 1500자, 권장 2000~2500자로 충분히 작성하세요.
- 각 문단을 3~5문장 이상으로 상세하게 서술하세요.

### 외국인 관점 필수 포함 사항
- 가장 가까운 지하철역 및 출구 번호 (알고 있다면)
- 가격은 모두 달러로 환산 (1 USD = 1,300 KRW 고정환율)
- 영어 메뉴 유무 ("English menu available" 또는 "Korean-only menu, but...")
- 카드 결제 가능 여부
- 외국인이 알면 좋은 팁 (예: 물은 셀프, 신발 벗는 곳 등)

## 사진 배치 규칙
${photos.length > 0 ? `- 반드시 모든 [PHOTO:n] 마커를 본문 중 적절한 위치에 삽입하세요.
- 사진은 해당 내용을 서술한 직후에 배치하세요 (예: 음식 묘사 후 음식 사진).
- 한 곳에 사진을 몰아넣지 말고 글 전체에 골고루 분산하세요.
- [PHOTO:n] 마커는 반드시 독립된 줄에 단독으로 작성하세요 (문장 중간에 넣지 마세요).` : "- 사진이 없으므로 [PHOTO] 마커를 사용하지 마세요."}

## 글 작성 전 계획 (중요!)
글을 바로 쓰지 말고, 먼저 아래 사항을 계획한 뒤 plan 필드에 간략히 적으세요:
- 어떤 에피소드나 장면으로 도입부를 열 것인가
- 중간에 어떤 감각 묘사(시각, 미각, 촉각, 후각)를 배치할 것인가
- 어떤 개인적 감상이나 동행자와의 대화를 넣을 것인가
- 마무리를 어떤 느낌으로 끝낼 것인가
이 계획을 바탕으로 한국어, 영어 글을 각각 작성하세요.

## 출력 형식 (JSON)
{
  "plan": "도입: ..., 중간: ..., 마무리: ... (한국어 2~3줄 요약)",
  "titleKo": "SEO 최적화된 한국어 제목 (20~40자)",
  "contentKo": "한국어 블로그 본문 (2500~4000자, 문단 구분은 \\n\\n, 사진 위치에 [PHOTO:n] 마커 삽입)",
  "hashtagsKo": ["#해시태그1", "#해시태그2", "#해시태그3", "#해시태그4", "#해시태그5", "#해시태그6", "#해시태그7"],
  "titleEn": "SEO optimized English title",
  "contentEn": "English blog post (1500~2500 chars, use \\n\\n for paragraphs, insert [PHOTO:n] markers at appropriate positions)",
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 120s timeout for gpt-5

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
          {
            role: "system",
            content: `당신은 한국에서 가장 인기 있는 블로거입니다. 실제 방문 경험을 생생하게 전달하는 것이 특기입니다.

작성 원칙:
- 절대 번호 매기기(1. 2. 3.)나 글머리 기호(- •)를 사용하지 마세요
- 소제목(##, ###)을 사용하지 마세요
- 모든 정보를 자연스러운 서술형 문단으로 풀어쓰세요
- 마치 친구에게 이야기하듯 생동감 있게 작성하세요
- 충분히 길고 상세하게 작성하세요 (한국어 2500자 이상, 영어 1500자 이상)
- "소개해 드리겠습니다", "알아보겠습니다" 같은 AI스러운 표현 절대 금지
- 반드시 plan 필드를 먼저 작성한 후 그 계획에 따라 글을 쓰세요`,
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("AI 응답 시간이 초과되었습니다 (50초). 다시 시도해주세요.");
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

  // response_format: json_object guarantees valid JSON, but keep fallback cleanup
  const jsonStr = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  let parsed: GeneratedContent & { plan?: string };
  try {
    parsed = JSON.parse(jsonStr) as GeneratedContent & { plan?: string };
  } catch {
    // Response was likely truncated by max_tokens
    throw new Error("AI 응답이 잘렸습니다. 다시 시도해주세요.");
  }

  // Strip the plan field (used for chain-of-thought, not shown to user)
  delete parsed.plan;

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
  return await callOpenAI(prompt, apiKey);
}
