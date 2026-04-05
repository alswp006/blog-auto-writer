import type { Place } from "@/lib/models/modelTypes";
import type { MenuItem } from "@/lib/models/modelTypes";
import type { Photo } from "@/lib/models/modelTypes";
import type { StyleProfile, UserProfile } from "@/lib/models/modelTypes";
import type { EnrichedPlaceInfo } from "@/lib/ai/enrich";
import type { PlaceInsight } from "@/lib/ai/agentResearch";
import type { PhotoDescription } from "@/lib/ai/photoDescribe";
import { validateContent } from "@/lib/ai/qualityGate";
import { callLLM, getProvider } from "@/lib/ai/providers";
import { getUserEditPatterns } from "@/lib/ai/editLearning";

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

// ── Few-shot style examples (three per category for Korean, one for English) ──

const CATEGORY_EXAMPLES: Record<string, { ko: string[]; en: string }> = {
  restaurant: {
    ko: [
      // 20s — 존댓말이되 짧은 문장, 직접적 감탄, 줌마체 어미(~거든요/~더라고요) 금지
      `간판 없는 골목집인데 이게 진짜 미쳤어요. 문 여는 순간 고기 냄새가 확 때리는데 아 여기 맞다 싶었어요. 메뉴가 딱 네 개. 근데 이런 집이 진짜 잘해요ㅋㅋ 삼겹살 올리자마자 지글지글 소리부터 다르고 한 입 먹었는데 겉바속촉에 육즙이 미친 거예요. 친구랑 눈 마주치고 말 안 해도 둘 다 알았어요. 여기 또 올 거예요.`,
      // 30s — ~해요 체 기본, 가끔 ~음/~임 섞어 리듬감, 실용 정보 중심
      `회사 동료가 알려준 점심 맛집인데, 외관은 솔직히 좀 허름해요. 가정집 개조한 느낌. 근데 된장찌개 하나 시켰더니 반찬이 일곱 가지. 김치가 직접 담근 건지 아삭하면서 맛이 깊고, 된장찌개는 두부가 흔들흔들 나왔는데 국물이 짜지 않고 구수해요. 8천원에 이 퀄리티면 주변 직장인들 점심 성지일 듯.`,
      // 감성 — 장면 중심, 짧은 문장과 긴 문장 교차, 감각 구체적
      `비 오는 날이었어요. 우산 쓰고 골목 안쪽으로 들어가니까 작은 유리문 너머로 김이 피어오르는 게 보였어요. 문 열고 들어서니 나무 테이블에서 올라오는 온기가 젖은 손끝까지 데워주는 느낌이었어요. 칼국수 한 그릇. 첫 숟가락에 멸치 육수 감칠맛이 혀 위로 퍼지면서 몸이 풀렸어요. 밖에서 빗소리 들으면서 먹는 그 국수가, 그날 하루를 바꿔놨어요.`,
    ],
    en: `Down a narrow alley, sign barely visible. I almost walked past it. But the sesame oil smell hit me the second I opened the door — okay, this is real. Menu had four items. That's usually a good sign. The galbitang came out and the broth was clear but deep. One sip and I just knew. Sometimes you don't need a long menu to know a place gets it.`,
  },
  cafe: {
    ko: [
      // 20s
      `여기 찐이에요. 인스타에서 보고 또 감성카페인가 했는데 들어가니까 완전 달랐어요. 원두 볶는 냄새가 바로 때리는데 아 직접 로스팅하는 집이구나 싶었어요. 아아 시켰는데 산미가 딱 제 취향이에요. 창가 자리 앉아서 멍때리기 ㄹㅇ 최고ㅋㅋ 다음에 노트북 들고 와야겠어요.`,
      // 30s
      `주택가 안쪽이라 네비 없으면 못 찾아요. 근데 찾아가면 그만한 보상이 있는 곳. 우드톤 인테리어가 과하지 않게 정리되어 있고 재즈가 적당한 볼륨으로 나와요. 에티오피아 원두 드립커피 시켰는데 과일향이 은은하게 올라옴. 크로플은 겉바속촉. 와이파이 빠르고 콘센트 있어서 작업하기 좋아요.`,
      // 감성
      `오래된 빌라 1층을 개조한 카페예요. 문 열면 나무 바닥이 삐걱거려요. 근데 그 소리가 싫지 않았어요. 바 앞에 서면 핸드드립 내리는 소리가 똑, 똑 들리고, 올라오는 향이 달콤하면서 고소해요. 창밖에 뒤뜰 나무가 보이는데 오후 햇살이 잎사귀 사이로 흔들려요. 커피 한 잔 들고 한참을 그냥 앉아 있었어요.`,
    ],
    en: `Found this place through Instagram but it's way better in person. Second-floor window seat, ginkgo trees outside going full golden in the afternoon light. Ordered their signature latte — expected vanilla but got this subtle hazelnut thing going on. Power outlets everywhere too, so I ended up staying three hours.`,
  },
  accommodation: {
    ko: [
      // 20s
      `체크인할 때 웰컴 드링크 주면서 루프탑 바 시간까지 알려줬어요. 방 들어가자마자 침대 다이빙했는데 이불 폭신한 거 실화..? 바로 못 일어났어요ㅋㅋ 야경도 살짝 보이고 어메니티가 이솝이라 씻고 나니까 저한테서 좋은 향이 나요. 이 가격에 이 정도면 완전 이득이에요.`,
      // 30s
      `로비 들어서면 디퓨저 향이 은은한데 과하지 않아요. 체크인 5분 컷. 직원분이 조식 시간이랑 주변 맛집 리스트까지 프린트해서 줬어요. 방은 20평 정도에 킹베드 기준 넉넉하고, 침구 감촉이 확실히 다른 게 400수 코튼인 것 같아요. 방음도 괜찮아서 복도 소리 거의 안 들리고, 조식 한식 뷔페는 갓 지은 밥이랑 된장국이 투숙객 전용치고 꽤 괜찮은 수준.`,
      // 감성
      `엘리베이터 문 열리고 복도를 걸어가는데 카펫이 두꺼워서 발소리가 안 나요. 방문 열자마자 넓은 창으로 저녁 노을이 들어와서 방 전체가 주황빛이었어요. 침대에 천천히 눕자 몸이 스르르 가라앉는 느낌이에요. 베개에서 라벤더 향이 났어요. 밤에 불 끄고 누우니까 창밖 도시 불빛이 별 같았어요.`,
    ],
    en: `Front desk handed me a welcome drink and went through breakfast hours and rooftop bar schedule. The king bed had that real hotel-quality feel — you sink in and don't want to get up. Caught a partial Namsan Tower view from the window, which was a nice bonus. Aesop toiletries in the bathroom. For the price, I'd come back.`,
  },
  attraction: {
    ko: [
      // 20s
      `안국역 1번 출구에서 걸어가면 5분도 안 걸려요. 평일이라 사람 없어서 사진 찍기 진짜 좋았어요. 돌담길이 예뻐서 걸으면서 계속 찍었어요ㅋㅋ 소나무 사이로 보이는 전각이 미쳤고 향원정 연못 앞에서 한참 서 있었어요. 여기 봄에 다시 올 거예요.`,
      // 30s
      `근처 공영주차장 이용했고 10분당 300원이에요. 입장료 3천원인데 한복 입으면 무료라서 같이 간 외국인 친구가 좋아했어요. 전체 관람은 1시간 반이면 충분하고, 경회루 쪽 전경이 제일 나아요. 화장실은 입구랑 안쪽 두 군데 있는데 안쪽이 덜 붐빔. 출구 나오면 바로 삼청동 카페거리라 코스로 엮기 좋아요.`,
      // 감성
      `아침 일찍 갔더니 안개가 낮게 깔려 있었어요. 돌담 위에 이슬이 맺혀 있고, 발밑 자갈 밟히는 소리가 고요한 공기 속에서 또각또각 울려요. 전각 처마 끝에서 아침 햇살이 비스듬히 내려와 마당에 긴 그림자를 만들고 있었어요. 소나무 사이 바람에서 흙냄새가 살짝 섞여 올라왔고, 그 순간만큼은 여기가 도심 한가운데라는 게 안 믿겼어요.`,
    ],
    en: `Five minutes from Anguk Station Exit 1. Went on a weekday morning so barely anyone around. Walking along the stone walls with a cool breeze, I got why this place draws millions every year. The deeper I went, the better it got — traditional pavilions framed by old pine trees. Felt like walking into a painting, honestly.`,
  },
};

// ── Sensory detail framework per category ──

const SENSORY_FRAMEWORK: Record<string, { ko: string; en: string }> = {
  restaurant: {
    ko: `### 오감 묘사 (반드시 2개 이상 포함)
- 후각: 가게 들어설 때 맡은 향 (고소한/매콤한/달콤한 등 구체적)
- 시각: 음식의 색감, 그릇, 플레이팅, 김이 모락모락
- 미각: 첫 맛, 씹을수록 느껴지는 맛, 식감(바삭/쫄깃/부드러운), 온도감
- 청각: 고기 굽는 지글지글, 국물 보글보글, 주방의 활기
- 촉각: 뜨거운 국물그릇, 나무젓가락 감촉`,
    en: `### Sensory Details (include at least 2)
- Smell: aroma upon entering (savory, smoky, sweet — be specific)
- Sight: dish colors, steam rising, plating presentation
- Taste: first bite, evolving flavors, texture (crispy/chewy/tender), temperature
- Sound: sizzling, bubbling, kitchen energy
- Touch: warmth of the bowl, chopstick feel`,
  },
  cafe: {
    ko: `### 오감 묘사 (반드시 2개 이상 포함)
- 후각: 문 열자마자 퍼지는 원두 향, 베이킹 냄새
- 시각: 인테리어 색감, 조명 톤, 음료 색상과 라떼아트
- 미각: 첫 모금의 온도와 맛, 산미/단맛/쓴맛 밸런스, 디저트 식감
- 청각: 배경 음악 장르, 커피머신 소리, 대화 소리의 크기
- 촉각: 컵의 질감(도자기/유리), 소파나 의자의 편안함`,
    en: `### Sensory Details (include at least 2)
- Smell: coffee aroma upon entering, baking scents
- Sight: interior colors, lighting mood, latte art, drink presentation
- Taste: first sip temperature, acidity/sweetness balance, dessert texture
- Sound: background music genre, espresso machine, ambient chatter
- Touch: cup material (ceramic/glass), seating comfort`,
  },
  accommodation: {
    ko: `### 오감 묘사 (반드시 2개 이상 포함)
- 촉각: 침구의 감촉(뽀송한/부드러운), 수건 질감, 슬리퍼 착용감
- 시각: 방 들어갈 때 첫 시야, 창밖 뷰, 조명 분위기
- 후각: 로비 향, 어메니티 향, 방의 깨끗한 냄새
- 청각: 방음 상태, 복도 소음, 창밖 소리`,
    en: `### Sensory Details (include at least 2)
- Touch: bedding texture, towel quality, slipper comfort
- Sight: room reveal moment, window view, lighting ambiance
- Smell: lobby fragrance, amenity scents, room freshness
- Sound: soundproofing quality, hallway noise, outside sounds`,
  },
  attraction: {
    ko: `### 오감 묘사 (반드시 2개 이상 포함)
- 시각: 풍경의 색감, 빛의 방향, 계절감, 인상적인 장면
- 촉각: 바람의 세기와 온도, 돌담/난간의 감촉, 햇살의 따뜻함
- 청각: 새소리, 물소리, 발걸음, 주변 사람들 소리
- 후각: 풀냄새, 꽃향기, 흙냄새 등 자연의 향`,
    en: `### Sensory Details (include at least 2)
- Sight: landscape colors, light direction, seasonal feel, standout scenes
- Touch: wind strength and temperature, stone/railing texture, sunlight warmth
- Sound: birdsong, water, footsteps, crowd levels
- Smell: grass, flowers, earth — nature's scents`,
  },
};

// ── Opening hook patterns ──

const OPENING_HOOKS_KO = [
  "장면 묘사로 시작: 그날의 날씨, 시간대, 거리 풍경을 먼저 그려주세요 (예: '비가 부슬부슬 내리던 화요일 오후, 골목 안쪽으로 걸어가다가...')",
  "독자에게 질문으로 시작: 호기심을 유발하세요 (예: '혹시 ~동에 이런 숨은 골목이 있는 줄 알았어요?')",
  "반전/대비로 시작: 기대와 현실의 차이 (예: '겉보기엔 평범한 가게인데, 문을 열자마자...')",
  "에피소드로 시작: 이 장소를 알게 된 계기 (예: '친구가 여기 꼭 가보라고 한 게 벌써 석 달 전이에요')",
  "감정 직구로 시작: 솔직한 감정 표현 (예: '솔직히 처음엔 기대 안 했어요', '진짜 여기는 꼭 알려드리고 싶었어요')",
];

const OPENING_HOOKS_EN = [
  "Start with scene-setting: paint the day — weather, time, the street vibe (e.g., 'It was a drizzly Tuesday afternoon when I turned into a narrow alley...')",
  "Start with a hook question: draw the reader in (e.g., 'Have you ever stumbled upon a place so good you wanted to keep it secret?')",
  "Start with contrast/surprise: set up then subvert expectations (e.g., 'From the outside, nothing about this place screams special — but step inside and...')",
  "Start with a personal anecdote: how you discovered it (e.g., 'A friend had been raving about this spot for months before I finally made it')",
  "Start with a direct emotional hook: honest and upfront (e.g., 'I have to be honest — I wasn't expecting much. But this place completely won me over.')",
];

// ── Age-based tone instructions ──

function getAgeToneInstruction(ageGroup: string): { ko: string; en: string } {
  switch (ageGroup) {
    case "20s":
      return {
        ko: `20대 어투 규칙:
- '~해요/~했어요/~이에요' 존댓말 기본이되, 문장을 짧게 끊기. 한 문장에 정보 하나.
- [절대 금지] 줌마체/아줌마 말투: '~거든요', '~더라고요', '~이었고요', '~나더라고요', '~하더라고요', '넘넘', '잇님', '^^', '~~'. 이런 거 쓰면 실패.
- 20대식 해요체: '~했는데요', '~인 거예요', '~같았어요', '~미쳤어요', '~좋았어요' 이런 식.
- 'ㅋㅋ', 'ㄹㅇ', '찐', '실화' 같은 표현 자연스럽게 섞기.
- 감탄은 직접적으로: '이거 진짜 미쳤어요', '무조건 가보세요', '나만 알고 싶은 곳이에요'
- 이모지 안 써도 됨. ^^나 ♡ 같은 건 줌마체라 절대 금지.`,
        en: "Write like a real 20-something: short sentences, direct reactions ('this was insane', 'absolutely worth it'), skip formal transitions, sound like you're texting a friend about a great find",
      };
    case "30s":
      return {
        ko: `30대 어투 규칙:
- '~해요/~했어요' 체 기본이되, 가끔 '~함', '~임'으로 끊어서 리듬감 주기.
- 실용 정보 자연스럽게 녹이기: 가격, 주차, 위치, 다른 곳과 비교.
- 과한 감탄 대신 담백한 평가: '괜찮은 수준', '이 가격에 이 정도면', '나쁘지 않아요'.
- 이모지 쓰지 않기. ㅋㅋ도 안 쓰거나 아주 가끔만.
- 문장은 중간 길이. 너무 짧지도 너무 길지도 않게.`,
        en: "Write like a 30-something with a blog: friendly but organized, include practical details (price, parking, comparison to alternatives), no excessive enthusiasm, dry wit is okay",
      };
    case "40plus":
    default:
      return {
        ko: `40대+ 어투 규칙:
- '~합니다/~했습니다' 체와 '~해요' 체 자연스럽게 혼용.
- 관찰이 디테일하고 차분함. 서두르지 않는 문장.
- 가격 대비 가치, 서비스 수준, 재방문 의향 등 판단 근거를 명확히.
- 감탄사나 유행어 사용 자제. 이모지 사용 안 함.
- 경험에서 우러나오는 비교: '여기저기 다녀봤지만', '이 동네에서는 ~'.`,
        en: "Write like an experienced reviewer: calm authoritative tone, detailed observations, value-for-money analysis, no slang or exclamations, measured praise backed by specifics",
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
  pastExcerpts?: string,
  enrichedPlace?: EnrichedPlaceInfo,
  placeInsight?: PlaceInsight,
  photoDescriptions?: PhotoDescription[],
  editPatterns?: string,
): string {
  const cat = place.category;
  const structure = CATEGORY_STRUCTURE[cat] ?? CATEGORY_STRUCTURE.restaurant;
  const examples = CATEGORY_EXAMPLES[cat] ?? CATEGORY_EXAMPLES.restaurant;
  const sensory = SENSORY_FRAMEWORK[cat] ?? SENSORY_FRAMEWORK.restaurant;

  // Age-weighted few-shot selection: keep the style matching user's age group,
  // then randomly pick 1 of the remaining 2 styles
  const ageGroup = userProfile?.ageGroup ?? "30s";
  const ageStyleIndex = ageGroup === "20s" ? 0 : ageGroup === "30s" ? 1 : 2;
  const koExamples: string[] = [examples.ko[ageStyleIndex]]; // always include matching style
  const otherIndices = [0, 1, 2].filter((i) => i !== ageStyleIndex);
  const randomOther = otherIndices[Math.floor(Math.random() * otherIndices.length)];
  koExamples.push(examples.ko[randomOther]);
  const exampleKoText = koExamples.map((ex, i) => `예시 ${i + 1}:\n${ex}`).join("\n\n");
  const exampleEnText = examples.en;
  const ageTone = getAgeToneInstruction(userProfile?.ageGroup ?? "30s");
  const toneDesc = style.analyzedTone;

  // Randomly select opening hook pattern
  const hookIdxKo = Math.floor(Math.random() * OPENING_HOOKS_KO.length);
  const hookIdxEn = Math.floor(Math.random() * OPENING_HOOKS_EN.length);
  const hookKo = OPENING_HOOKS_KO[hookIdxKo];
  const hookEn = OPENING_HOOKS_EN[hookIdxEn];

  // Seasonal context
  const now = new Date();
  const month = now.getMonth() + 1;
  const seasonKo = month >= 3 && month <= 5 ? "봄" : month >= 6 && month <= 8 ? "여름" : month >= 9 && month <= 11 ? "가을" : "겨울";

  let prompt = `당신은 한국의 인기 블로거입니다. 아래 장소 방문 경험을 바탕으로 한국어 블로그 글과 영어 블로그 글을 각각 작성하세요.

## 장소 정보
- 이름: ${place.name}
- 카테고리: ${cat}
- 주소: ${place.address ?? "미입력"}
- 별점: ${place.rating ?? "미입력"}/5
- 방문 시기: ${now.getFullYear()}년 ${month}월 (${seasonKo})
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
    prompt += `모든 사진을 한 곳에 몰아넣지 말고, 글의 맥락에 맞게 분산 배치하세요.\n`;
    prompt += `배치 규칙: 첫 번째 사진은 글 시작 800자 이내에, 사진 사이에는 최소 200자 이상 텍스트를 넣으세요.\n\n`;

    // Build a lookup of rich descriptions by orderIndex
    const descMap = new Map<number, PhotoDescription>();
    if (photoDescriptions) {
      for (const pd of photoDescriptions) {
        descMap.set(pd.orderIndex, pd);
      }
    }

    for (const photo of photos) {
      const desc = descMap.get(photo.orderIndex);
      if (desc && desc.richDescription) {
        prompt += `- [PHOTO:${photo.orderIndex}] (${desc.photoType}): ${desc.richDescription}\n`;
      } else {
        prompt += `- [PHOTO:${photo.orderIndex}]: ${photo.caption ?? "(설명 없음)"}\n`;
      }
    }
  }

  if (userMemo) {
    prompt += `\n## 작성자 메모\n${userMemo}\n`;
  }

  // ── Enriched place data (from Naver/Google APIs) ──
  if (enrichedPlace) {
    const hasData = enrichedPlace.naverCategory || enrichedPlace.roadAddress ||
      enrichedPlace.blogKeywords.length > 0 || enrichedPlace.blogExcerpts.length > 0;
    if (hasData) {
      prompt += `\n## 보강 장소 정보 (참고용 — 그대로 복사하지 말고 자연스럽게 녹여쓰세요)\n`;
      if (enrichedPlace.naverCategory) {
        prompt += `- 네이버 카테고리: ${enrichedPlace.naverCategory}\n`;
      }
      if (enrichedPlace.roadAddress) {
        prompt += `- 도로명 주소: ${enrichedPlace.roadAddress}\n`;
      }
      if (enrichedPlace.blogKeywords.length > 0) {
        prompt += `- 블로그에서 자주 언급되는 키워드: ${enrichedPlace.blogKeywords.slice(0, 10).join(", ")}\n`;
      }
      if (enrichedPlace.blogExcerpts.length > 0) {
        prompt += `- 다른 블로거 후기 발췌 (톤 참고용):\n`;
        for (const excerpt of enrichedPlace.blogExcerpts.slice(0, 3)) {
          prompt += `  > ${excerpt.slice(0, 200)}\n`;
        }
      }
    }
  }

  // ── AI Research insights ──
  if (placeInsight) {
    const hasInsight = placeInsight.atmosphere || placeInsight.popularMenus.length > 0 ||
      placeInsight.tips.length > 0 || placeInsight.nearbyLandmarks.length > 0 ||
      placeInsight.recentTrends || placeInsight.visitorSentiment;
    if (hasInsight) {
      prompt += `\n## AI 리서치 결과 (참고용 — 직접 체험한 것처럼 자연스럽게 활용하세요)\n`;
      if (placeInsight.atmosphere) {
        prompt += `- 분위기: ${placeInsight.atmosphere}\n`;
      }
      if (placeInsight.popularMenus.length > 0) {
        prompt += `- 인기 메뉴: ${placeInsight.popularMenus.join(", ")}\n`;
      }
      if (placeInsight.tips.length > 0) {
        prompt += `- 방문 팁: ${placeInsight.tips.join(" / ")}\n`;
      }
      if (placeInsight.nearbyLandmarks.length > 0) {
        prompt += `- 근처 교통/랜드마크: ${placeInsight.nearbyLandmarks.join(", ")}\n`;
      }
      if (placeInsight.recentTrends) {
        prompt += `- 최근 변화: ${placeInsight.recentTrends}\n`;
      }
      if (placeInsight.visitorSentiment) {
        prompt += `- 방문자 평가: ${placeInsight.visitorSentiment}\n`;
      }
      if (placeInsight.bestPhotoSpots.length > 0) {
        prompt += `- 사진 포인트: ${placeInsight.bestPhotoSpots.join(", ")}\n`;
      }
    }
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

### 도입부 스타일 (이번 글에 적용)
${hookKo}

### 참고 예시 (이런 톤과 흐름으로 작성하세요)
${exampleKoText}

${sensory.ko}

### 글 분량 (중요!)
- 최소 2500자, 권장 3000~4000자의 충분한 분량으로 작성하세요.
- 실제 인기 블로거의 글처럼 풍부하고 상세하게 작성하세요.
- 각 문단은 3~5문장 이상으로 충분히 서술하세요.
- 개인적인 에피소드, 감상, 디테일한 묘사를 풍부하게 넣으세요.

### 어투 스타일
${ageTone.ko}
- 문체 톤: ${toneDesc.tone ?? "casual"} / 격식: ${toneDesc.formality ?? "medium"} / 감정: ${toneDesc.emotion ?? "warm"}
${style.sampleTexts.slice(0, 3).map((s, i) => `- 문체 샘플 ${i + 1}: "${s}"`).join("\n")}

${pastExcerpts ? `### 이전에 작성한 글 (이 문체와 톤을 유지하세요)
${pastExcerpts}
` : ""}${editPatterns ? `${editPatterns}
` : ""}### 자연스러운 블로그 글쓰기 (중요!)
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

### AI스러운 표현 → 자연스러운 대체 (이 표를 반드시 참고하세요)
| ❌ 쓰지 마세요 | ✅ 이렇게 바꾸세요 |
| "다양한 메뉴" | "메뉴가 꽤 많은데" 또는 구체적으로 나열 |
| "특별한 경험" | 구체적으로 뭐가 특별했는지 서술 |
| "완벽한 조화" | "이게 같이 먹으니까 진짜 잘 어울리더라고요" |
| "분위기를 자아내다" | "~한 느낌이었어요" 또는 구체적 묘사 |
| "눈길을 사로잡다" | "딱 보자마자 이거다 싶었어요" |
| "입안 가득 퍼지는" | "한 입 먹으니까 ~맛이 확 올라오더라고요" |
| "조화롭게 어우러진" | "같이 먹으니까 진짜 찰떡이에요" |
| "한 폭의 그림 같은" | 구체적 색감/빛 묘사로 대체 |
| "가히 압권이다" | "이건 진짜 대박이었어요" 또는 구체적 반응 |
| "미식의 여정" / "맛의 향연" | 쓰지 말 것 — 직접적 맛 묘사로 |
| "정성이 느껴지는" | "사장님이 직접 ~하시는 게 보였어요" 등 구체적 |
| "추천드립니다" / "강추합니다" | "여기는 진짜 또 갈 거예요" / "친구한테 바로 공유했어요" |
| "~의 매력에 빠지다" | 구체적으로 뭐가 좋았는지 |
| "~를 자랑하다" | 쓰지 말 것 |

### 영어 AI 표현 금지
- "nestled in" → "tucked away in" or "just off [street name]"
- "a symphony of flavors" → describe the actual flavors
- "culinary journey/adventure" → don't use, just describe the meal
- "hidden gem" → "a place I almost walked past"
- "tantalizing" → use specific descriptors (smoky, tangy, rich)
- "delectable" / "delightful" → banned, use concrete descriptions
- "boasts" / "offers" → "has" / "they have"
- "bustling" → describe what you actually see/hear
- "mouth-watering" → describe the actual sensation
- "authentic" → describe why it feels real

### SEO 제목
- 장소명 + 카테고리 키워드 포함
- 클릭 유도하는 매력적인 제목 (20~40자)

### SEO 키워드 최적화 (중요!)
- 장소명("${place.name}")을 본문에서 자연스럽게 3~5회 반복하세요 (첫 문단, 중간, 마지막에 분산)
- 카테고리 관련 핵심 키워드(예: 맛집, 카페, 숙소, 여행)를 2~3회 자연스럽게 녹이세요
- 지역명이 있으면 "지역+카테고리" 조합도 넣으세요 (예: "강남 맛집", "홍대 카페")
- 키워드를 억지로 넣지 말고, 문장 흐름 안에서 자연스럽게 배치하세요

### 해시태그 전략 (SEO 핵심)
- 한국어 해시태그: 10~15개 (네이버 블로그 최적)
  - 장소명 해시태그 필수 (예: #${place.name.replace(/\s/g, "")})
  - 지역+카테고리 롱테일 키워드 3~5개 (예: #강남역맛집 #홍대카페추천 #서울브런치)
  - 일반 카테고리 키워드 3~4개 (예: #맛집추천 #카페투어 #서울맛집)
  - 메뉴/특징 관련 키워드 2~3개 (예: #파스타맛집 #루프탑카페)
- 영어 해시태그: 8~12개
  - Place name hashtag required
  - Location + category long-tail 3~4 (e.g., #SeoulFood #GangnamRestaurant)
  - General category 2~3 (e.g., #KoreanFood #CafeHopping)
  - Menu/feature specific 2~3

## 영어 글 작성 지침
영어 글은 한국어를 번역하지 말고, 한국을 방문한 외국인 관점에서 완전히 새로 작성하세요.
${structure.en}

### Opening Style (use this for the English post)
${hookEn}

### English Style Example (write with this tone and flow)
${exampleEnText}

${sensory.en}

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
  "hashtagsKo": ["#장소명", "#지역맛집", "#카테고리키워드", "...10~15개 총"],
  "titleEn": "SEO optimized English title",
  "contentEn": "English blog post (1500~2500 chars, use \\n\\n for paragraphs, insert [PHOTO:n] markers at appropriate positions)",
  "hashtagsEn": ["#PlaceName", "#SeoulFood", "#CategoryKeyword", "...8~12개 총"]
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

// ── Self-refine: 2-step polish pass ──

interface AiExpression {
  text: string;
  location: "ko" | "en";
  reason: string;
}

/**
 * Step 1: Ask LLM to find AI-sounding expressions (critique only, no rewriting).
 * Returns a structured list of problematic expressions.
 */
async function findAiExpressions(
  content: GeneratedContent,
  apiKey: string,
): Promise<AiExpression[]> {
  const prompt = `아래 블로그 글에서 AI가 쓴 것 같은 표현을 **찾기만** 하세요. 고치지 마세요.

## 감지 기준
- 실제 사람이 안 쓰는 수식어 (다양한, 특별한, 완벽한, 조화로운, 독특한, 풍부한)
- 과도한 미사여구 (분위기를 자아내다, 눈길을 사로잡다, 입안 가득 퍼지는, 맛의 향연)
- 안내형 도입 (소개해 드리겠습니다, 알아보겠습니다)
- 뻔한 마무리 (추천드립니다, 강추합니다, 마지막으로)
- 같은 표현 반복 (같은 단어/표현이 2회 이상 등장)
- 부자연스러운 존댓말 혼용
- 영어: "nestled", "symphony of flavors", "culinary journey", "hidden gem", "tantalizing", "delectable", "boasts", "bustling", "mouth-watering", "a testament to", "elevate"

## 한국어 글
제목: ${content.titleKo}
본문:
${content.contentKo}

## 영어 글
제목: ${content.titleEn}
본문:
${content.contentEn}

JSON으로 반환 (고치지 말고 찾기만):
{
  "expressions": [
    { "text": "발견한 AI 표현 원문", "location": "ko 또는 en", "reason": "왜 AI스러운지 한 줄 설명" }
  ]
}
표현이 없으면 { "expressions": [] }`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

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
            content: "블로그 품질 감수 전문가입니다. AI가 생성한 것 같은 부자연스러운 표현을 정확하게 찾아내는 것이 전문입니다. 수정은 하지 말고 찾기만 하세요.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 2048,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return [];

    const parsed = JSON.parse(text) as { expressions?: AiExpression[] };
    return parsed.expressions ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Step 2: Given the list of AI expressions found, rewrite only those parts.
 */
async function polishContent(
  content: GeneratedContent,
  apiKey: string,
): Promise<GeneratedContent> {
  // Step 1: Find AI expressions
  const expressions = await findAiExpressions(content, apiKey);
  if (expressions.length === 0) return content; // nothing to fix

  // Step 2: Rewrite only the found expressions
  const expressionList = expressions
    .map((e, i) => `${i + 1}. [${e.location}] "${e.text}" — ${e.reason}`)
    .join("\n");

  const prompt = `아래 블로그 글에서 다음 AI스러운 표현들이 발견되었습니다. 이 표현들**만** 자연스럽게 고쳐주세요.

## 발견된 AI 표현 (이것들만 수정)
${expressionList}

## 수정 규칙
- 위 목록에 있는 표현만 수정 — 나머지는 원문 그대로 유지
- 글의 전체 구조, 문단 수, 길이 유지
- [PHOTO:n] 마커 절대 제거/이동 금지
- 새로운 정보 추가 금지
- 해시태그 수정 금지
- 약한 묘사는 오감 활용한 구체적 표현으로 대체

## 한국어 글
제목: ${content.titleKo}
본문:
${content.contentKo}

## 영어 글
제목: ${content.titleEn}
본문:
${content.contentEn}

수정된 전체 글을 JSON으로 반환:
{
  "titleKo": "수정된 한국어 제목",
  "contentKo": "수정된 한국어 본문",
  "titleEn": "Fixed English title",
  "contentEn": "Fixed English content"
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

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
            content: "블로그 편집 전문가입니다. 지정된 AI 표현만 골라서 실제 사람이 쓴 것처럼 고치세요. 지정되지 않은 부분은 한 글자도 바꾸지 마세요.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return content;

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return content;

    let polished: Partial<GeneratedContent>;
    try {
      polished = JSON.parse(text) as Partial<GeneratedContent>;
    } catch {
      return content;
    }

    // Validate that polish didn't strip PHOTO markers
    const originalMarkers = (content.contentKo?.match(/\[PHOTO:\d+\]/g) ?? []).sort();
    const polishedMarkers = (polished.contentKo?.match(/\[PHOTO:\d+\]/g) ?? []).sort();
    const markersIntact = originalMarkers.length === polishedMarkers.length &&
      originalMarkers.every((m, i) => m === polishedMarkers[i]);

    if (!markersIntact) return content;

    // Calculate polish usage for tracking (both calls combined)
    const polishUsage = data.usage
      ? {
          model: data.model ?? "unknown",
          inputTokens: (content.usage?.inputTokens ?? 0) + (data.usage.prompt_tokens ?? 0),
          outputTokens: (content.usage?.outputTokens ?? 0) + (data.usage.completion_tokens ?? 0),
        }
      : content.usage;

    const polishedContent: GeneratedContent = {
      titleKo: polished.titleKo || content.titleKo,
      contentKo: polished.contentKo || content.contentKo,
      hashtagsKo: content.hashtagsKo,
      titleEn: polished.titleEn || content.titleEn,
      contentEn: polished.contentEn || content.contentEn,
      hashtagsEn: content.hashtagsEn,
      usage: polishUsage,
    };

    // Polish quality guard: only keep polished version if it's at least as good
    const originalScore = validateContent(content, originalMarkers.length, "").score;
    const polishedScore = validateContent(polishedContent, originalMarkers.length, "").score;
    if (polishedScore < originalScore - 5) {
      return content; // polish made it worse — keep original
    }

    return polishedContent;
  } catch {
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Provider-agnostic generation call ──

// ── Competitor analysis + auto-improvement ──

type CompetitorAnalysis = {
  missing: string[];
  improvements: string[];
};

async function analyzeCompetitors(
  content: GeneratedContent,
  place: Place,
  photoCount: number,
  apiKey: string,
): Promise<CompetitorAnalysis | null> {
  const catKo: Record<string, string> = {
    restaurant: "맛집", cafe: "카페", accommodation: "숙소", attraction: "관광지",
  };
  const categoryLabel = catKo[place.category] ?? place.category;

  const prompt = `당신은 네이버/구글 블로그 SEO 전문가입니다. 아래 블로그 글을 "${place.name} ${categoryLabel}" 키워드의 상위 노출 경쟁 글들과 비교 분석해주세요.

## 현재 글 정보
- 제목: ${content.titleKo}
- 장소: ${place.name} (${categoryLabel})
- 주소: ${place.address ?? "미입력"}
- 본문 길이: ${content.contentKo.length}자
- 사진 수: ${photoCount}장
- 해시태그: ${content.hashtagsKo.join(", ")}

## 현재 글 (첫 1000자)
${content.contentKo.slice(0, 1000)}...

## 분석 요청
이 글이 상위 노출되려면 부족한 점과 구체적 개선사항을 알려주세요.
JSON으로 응답:
{
  "missing": ["빠져있는 중요 요소 (최대 3개, 구체적으로)"],
  "improvements": ["실행 가능한 개선 제안 (최대 4개, 본문에 바로 반영 가능한 것만)"]
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

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
          { role: "system", content: "블로그 SEO 전문가로서 경쟁 분석을 수행합니다. 한국 블로그 상위 노출 패턴에 정통합니다. 실행 가능한 조언만 하세요." },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 800,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;

    const parsed = JSON.parse(text) as CompetitorAnalysis;
    if (!parsed.improvements?.length && !parsed.missing?.length) return null;
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function applyCompetitorInsights(
  content: GeneratedContent,
  analysis: CompetitorAnalysis,
  apiKey: string,
): Promise<GeneratedContent> {
  const feedbackList = [
    ...(analysis.missing ?? []).map((m) => `[빠진 요소] ${m}`),
    ...(analysis.improvements ?? []).map((i) => `[개선] ${i}`),
  ].join("\n");

  const prompt = `아래 블로그 글에 대해 경쟁글 분석 결과 다음과 같은 개선점이 나왔습니다. 이 피드백을 반영해서 글을 개선해주세요.

## 개선 피드백
${feedbackList}

## 수정 규칙
- 피드백을 자연스럽게 기존 글에 녹여서 반영 (새 문단 추가보다 기존 문단 보강 우선)
- 글의 전체 구조와 톤 유지
- [PHOTO:n] 마커 절대 제거/이동 금지
- 해시태그는 부족한 키워드가 있으면 추가, 기존 것은 유지
- 영어 글도 같은 방향으로 개선
- 글 길이를 줄이지 말 것

## 한국어 글
제목: ${content.titleKo}
본문:
${content.contentKo}

해시태그: ${content.hashtagsKo.join(", ")}

## 영어 글
제목: ${content.titleEn}
본문:
${content.contentEn}

해시태그: ${content.hashtagsEn.join(", ")}

수정된 전체 글을 JSON으로 반환:
{
  "titleKo": "개선된 한국어 제목",
  "contentKo": "개선된 한국어 본문",
  "hashtagsKo": ["#해시태그1", ...],
  "titleEn": "Improved English title",
  "contentEn": "Improved English content",
  "hashtagsEn": ["#hashtag1", ...]
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

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
            content: "블로그 편집 전문가입니다. 경쟁 분석 피드백을 반영하여 글의 SEO와 품질을 개선하세요. 기존 글의 톤과 자연스러움은 유지하면서 부족한 요소만 보강하세요.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return content;
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return content;

    let improved: Partial<GeneratedContent>;
    try {
      improved = JSON.parse(text) as Partial<GeneratedContent>;
    } catch {
      return content;
    }

    // Validate PHOTO markers preserved
    const originalMarkers = (content.contentKo?.match(/\[PHOTO:\d+\]/g) ?? []).sort();
    const improvedMarkers = (improved.contentKo?.match(/\[PHOTO:\d+\]/g) ?? []).sort();
    const markersIntact = originalMarkers.length === improvedMarkers.length &&
      originalMarkers.every((m, i) => m === improvedMarkers[i]);
    if (!markersIntact) return content;

    // Accumulate usage
    const improvedUsage = data.usage
      ? {
          model: data.model ?? "unknown",
          inputTokens: (content.usage?.inputTokens ?? 0) + (data.usage.prompt_tokens ?? 0),
          outputTokens: (content.usage?.outputTokens ?? 0) + (data.usage.completion_tokens ?? 0),
        }
      : content.usage;

    const result: GeneratedContent = {
      titleKo: improved.titleKo || content.titleKo,
      contentKo: improved.contentKo || content.contentKo,
      hashtagsKo: Array.isArray(improved.hashtagsKo) && improved.hashtagsKo.length > 0 ? improved.hashtagsKo : content.hashtagsKo,
      titleEn: improved.titleEn || content.titleEn,
      contentEn: improved.contentEn || content.contentEn,
      hashtagsEn: Array.isArray(improved.hashtagsEn) && improved.hashtagsEn.length > 0 ? improved.hashtagsEn : content.hashtagsEn,
      usage: improvedUsage,
    };

    // Quality guard: reject if improvement made quality worse
    const originalScore = validateContent(content, originalMarkers.length, "").score;
    const improvedScore = validateContent(result, originalMarkers.length, "").score;
    if (improvedScore < originalScore - 5) return content;

    return result;
  } catch {
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function callLLMAndParse(
  systemPrompt: string,
  userPrompt: string,
): Promise<GeneratedContent> {
  const result = await callLLM({
    systemPrompt,
    userPrompt,
    maxTokens: 8192,
    timeout: 120_000,
  });

  let parsed: GeneratedContent & { plan?: string };
  try {
    parsed = JSON.parse(result.content) as GeneratedContent & { plan?: string };
  } catch {
    throw new Error("AI 응답이 잘렸습니다. 다시 시도해주세요.");
  }

  delete parsed.plan;

  if (!parsed.titleKo || !parsed.contentKo || !parsed.titleEn || !parsed.contentEn) {
    throw new Error("AI 응답이 불완전합니다");
  }

  return {
    titleKo: parsed.titleKo,
    contentKo: parsed.contentKo,
    hashtagsKo: Array.isArray(parsed.hashtagsKo) ? parsed.hashtagsKo : [],
    titleEn: parsed.titleEn,
    contentEn: parsed.contentEn,
    hashtagsEn: Array.isArray(parsed.hashtagsEn) ? parsed.hashtagsEn : [],
    usage: result.usage,
  };
}

// ── Main export ──

export type ProgressCallback = (step: string, message: string) => void;

export async function generateBlogPost(
  place: Place,
  menuItems: MenuItem[],
  photos: Photo[],
  style: StyleProfile,
  userProfile: UserProfile | null,
  userMemo: string,
  isRevisit: boolean = false,
  pastExcerpts?: string,
  enrichedPlace?: EnrichedPlaceInfo,
  placeInsight?: PlaceInsight,
  photoDescriptions?: PhotoDescription[],
  onProgress?: ProgressCallback,
): Promise<GeneratedContent> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return generateFallback(place, menuItems, photos, style, userProfile, userMemo);
  }

  const provider = getProvider();
  const useProvider = provider === "anthropic" && process.env.ANTHROPIC_API_KEY;

  const systemPrompt = `당신은 한국에서 가장 인기 있는 블로거입니다. 실제 방문 경험을 생생하게 전달하는 것이 특기입니다.

작성 원칙:
- 절대 번호 매기기(1. 2. 3.)나 글머리 기호(- •)를 사용하지 마세요
- 소제목(##, ###)을 사용하지 마세요
- 모든 정보를 자연스러운 서술형 문단으로 풀어쓰세요
- 마치 친구에게 이야기하듯 생동감 있게 작성하세요
- 충분히 길고 상세하게 작성하세요 (한국어 2500자 이상, 영어 1500자 이상)
- "소개해 드리겠습니다", "알아보겠습니다" 같은 AI스러운 표현 절대 금지
- 반드시 plan 필드를 먼저 작성한 후 그 계획에 따라 글을 쓰세요`;

  onProgress?.("generating", "AI 글 생성 중...");

  // Fetch user edit patterns for personalization
  let editPatterns: string | undefined;
  if (userProfile?.userId) {
    try {
      const patterns = await getUserEditPatterns(userProfile.userId);
      if (patterns) editPatterns = patterns;
    } catch {
      // Edit pattern fetch failure is non-critical — continue without it
    }
  }

  const prompt = buildPrompt(
    place, menuItems, photos, style, userProfile, userMemo,
    isRevisit, pastExcerpts, enrichedPlace, placeInsight, photoDescriptions,
    editPatterns,
  );

  let draft: GeneratedContent;
  if (useProvider) {
    // Use unified provider (OpenAI or Anthropic)
    draft = await callLLMAndParse(systemPrompt, prompt);
  } else {
    draft = await callOpenAI(prompt, apiKey);
  }

  // ── Quality gate: validate and retry once if needed ──
  onProgress?.("validating", "품질 검증 중...");
  const check = validateContent(draft, photos.length, place.name);
  if (!check.passed && check.feedback) {
    onProgress?.("generating", "품질 미달 — 재생성 중...");
    const retryPrompt = prompt + `\n\n## ⚠️ 재생성 피드백\n${check.feedback}`;
    try {
      if (useProvider) {
        draft = await callLLMAndParse(systemPrompt, retryPrompt);
      } else {
        draft = await callOpenAI(retryPrompt, apiKey);
      }
    } catch {
      // retry failed — use original draft
    }
  }

  // Self-refine: polish pass (실패해도 원본 반환)
  onProgress?.("polishing", "글 다듬는 중...");
  let result = await polishContent(draft, apiKey);

  // Competitor analysis + auto-improvement
  onProgress?.("analyzing", "경쟁글 분석 중...");
  const competitorAnalysis = await analyzeCompetitors(result, place, photos.length, apiKey);
  if (competitorAnalysis && (competitorAnalysis.improvements.length > 0 || competitorAnalysis.missing.length > 0)) {
    onProgress?.("improving", "경쟁 분석 반영 중...");
    result = await applyCompetitorInsights(result, competitorAnalysis, apiKey);
  }

  onProgress?.("done", "완료!");
  return result;
}
