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
      // Casual 20s style
      `골목 끝에 간판도 제대로 없는 집이길래 솔직히 좀 의심했거든요ㅋㅋ 근데 문 열자마자 고기 굽는 냄새가 확 올라오는데 이건 진짜다 싶었어요. 메뉴가 딱 네 개밖에 없는데 오히려 이런 집이 잘하잖아요. 삼겹살 첫 점 올리자마자 지글지글 소리부터 남달랐고, 한 입 먹으니까 겉은 바삭한데 안은 육즙이 터지는 거예요. 친구랑 둘이서 눈 마주치고 아무 말 안 해도 알겠더라고요. 여기 또 온다.`,
      // 30s detailed style
      `회사 동료가 점심 맛집이라고 알려준 곳인데, 외관은 솔직히 기대 이하였어요. 허름한 가정집 같은 느낌. 근데 들어가서 된장찌개 하나 시켰는데 반찬이 일곱 가지가 나오더라고요. 김치가 직접 담근 건지 아삭하면서 깊은 맛이 났고, 된장찌개는 두부가 뜨끈하게 흔들리면서 나왔는데 국물이 짜지 않고 구수했어요. 8천원인데 이 퀄리티면 주변 직장인들한테는 성지 같은 곳이겠다 싶었어요.`,
      // Sensory/emotional style
      `비 오는 날이었어요. 우산 쓰고 찾아간 골목 안쪽, 작은 유리문 너머로 김이 모락모락 피어오르는 게 보였어요. 안으로 들어서니 나무 테이블에서 올라오는 따뜻한 온기가 젖은 손끝까지 녹여주는 느낌이었어요. 칼국수 한 그릇이 나왔는데, 첫 숟가락에 멸치 육수의 깊은 감칠맛이 혀 위로 퍼지면서 몸 전체가 풀리는 것 같았어요. 밖에서 후두둑 떨어지는 빗소리를 들으며 먹는 그 국수가, 그날 하루를 완전히 바꿔놨어요.`,
    ],
    en: `Tucked away in a narrow alley, this place had me skeptical at first — the sign was tiny and easy to miss. But the moment I stepped inside, the rich aroma of sesame oil hit me and I knew I was in for something good. The menu was refreshingly short, which in my experience is always a promising sign. When the galbitang arrived, the broth had that beautiful clear-yet-deeply-flavored look, and one sip confirmed it — this was the real deal.`,
  },
  cafe: {
    ko: [
      // Casual 20s style
      `여기 진짜 찐이에요. 인스타에서 봤을 때는 또 감성카페인가 했는데 들어가니까 분위기부터 다르더라고요. 원두 볶는 냄새가 코끝을 찌르는데 이건 직접 로스팅하는 집이구나 바로 느껴졌어요. 아아 시켰는데 한 모금 마시니까 산미가 딱 제 취향이었고요. 창가 자리에 앉아서 멍때리기 최고였어요ㅋㅋ`,
      // 30s detailed style
      `지인 추천으로 찾아간 동네 카페인데, 위치가 주택가 안쪽이라 네비 없으면 못 찾아요. 근데 찾아가면 보상받는 느낌이에요. 인테리어가 과하지 않게 우드톤으로 정리되어 있고, 스피커에서 재즈가 적당한 볼륨으로 나와요. 드립커피를 시켰는데 에티오피아 원두로 내린 거라 과일향이 은은하게 올라왔어요. 크로플도 겉바속촉 그 자체. 와이파이 빠르고 콘센트도 있어서 노트북 작업하기에 최적이었어요.`,
      // Sensory/emotional style
      `오래된 빌라 1층을 개조한 카페인데, 문을 열면 나무 바닥이 삐걱거려요. 근데 그 소리가 싫지 않고 오히려 정겨웠어요. 바 앞에 서니까 핸드드립 내리는 소리가 똑똑 들리고, 추출되면서 올라오는 향이 달콤하면서도 고소했어요. 창밖으로 뒤뜰 나무가 보이는데 오후 햇살이 잎사귀 사이로 흔들리는 게 참 좋더라고요. 커피 한 잔 들고 그냥 한참을 앉아 있었어요.`,
    ],
    en: `I stumbled upon this cafe through Instagram and it honestly looked even better in person. Sitting by the second-floor window, I had a perfect view of ginkgo trees with golden leaves catching the afternoon sunlight. Their signature latte surprised me — what I expected to be vanilla had this subtle hazelnut undertone. Power outlets at every seat made it perfect for working remotely too.`,
  },
  accommodation: {
    ko: [
      // Casual 20s style
      `체크인하는데 프론트 언니가 웰컴 드링크 주면서 루프탑 바 시간까지 알려주더라고요. 방 들어가자마자 침대에 다이빙했는데 이불이 진짜 뽀송해서 바로 못 일어났어요ㅋㅋ 창밖에 야경 살짝 보이는 것도 기분 좋았고, 욕실 어메니티가 이솝이라 씻고 나니까 몸에서 좋은 향이 났어요. 가격 대비 이 정도면 완전 이득이에요.`,
      // 30s detailed style
      `로비 들어서자마자 은은한 디퓨저 향이 나는데 고급스럽되 과하지 않았어요. 체크인 5분도 안 걸렸고, 직원분이 조식 뷔페 시간이랑 주변 맛집 리스트를 프린트해서 주셨어요. 방은 20평 정도 되는데 킹베드 기준으로 넉넉했고, 침구가 400수 코튼인지 감촉이 확실히 달랐어요. 방음도 괜찮은 편이라 복도 소리가 거의 안 들렸어요. 조식은 한식 뷔페인데 갓 지은 밥이랑 된장국이 투숙객 전용치고는 꽤 수준급이었어요.`,
      // Sensory/emotional style
      `엘리베이터 문이 열리고 복도를 걸어가는데, 발밑 카펫이 두꺼워서 발소리가 하나도 안 나더라고요. 방문을 열자마자 넓은 창으로 들어오는 저녁 노을빛이 방 전체를 주황색으로 물들이고 있었어요. 침대에 천천히 눕자 몸이 스르르 가라앉는 느낌. 베개에서 은은한 라벤더 향이 나면서 여행의 피로가 녹아내리는 것 같았어요. 밤에 불 끄고 누우니까 창밖으로 도시 불빛이 별처럼 보였어요.`,
    ],
    en: `Check-in was smooth — the front desk handed me a welcome drink and walked me through breakfast hours and rooftop bar schedule. The king-size bed had that distinctly plush hotel bedding feel. Through the window I caught a partial view of Namsan Tower, which was a nice bonus. The Aesop bathroom amenities were a pleasant surprise.`,
  },
  attraction: {
    ko: [
      // Casual 20s style
      `안국역 1번 출구에서 걸어갔는데 5분도 안 걸렸어요. 평일이라 사람 별로 없어서 사진 찍기 완전 좋았고요. 돌담길이 진짜 예뻐서 걸으면서 계속 찍었어요ㅋㅋ 소나무 사이로 보이는 전각이 진짜 멋있었는데 특히 향원정 연못 앞에서 한참 서 있었어요. 여기는 봄에 다시 와야겠다.`,
      // 30s detailed style
      `주차는 근처 공영주차장에 했고 10분당 300원이에요. 입장료가 3천원인데 외국인은 한복 입으면 무료라 같이 간 외국인 친구가 좋아하더라고요. 전체 관람 코스는 1시간 반 정도면 충분하고, 경회루 쪽에서 보는 전경이 가장 좋았어요. 화장실은 입구 근처에 하나, 안쪽에 하나 있는데 안쪽이 덜 붐벼요. 출구 나오면 바로 삼청동 카페거리라 코스로 묶기 좋아요.`,
      // Sensory/emotional style
      `아침 일찍 갔더니 안개가 낮게 깔려 있었어요. 돌담 위에 이슬이 맺혀 있고, 발밑에 자갈 밟히는 소리가 고요한 공기 속에 또각또각 울리더라고요. 전각 처마 끝에서 아침 햇살이 비스듬하게 내려와 마당에 긴 그림자를 만들고 있었어요. 소나무 사이를 지나는 바람에서 살짝 흙냄새가 섞여 올라왔고, 그 순간만큼은 도심 한가운데라는 게 믿기지 않았어요.`,
    ],
    en: `From Anguk Station Exit 1, it was just a five-minute walk to the entrance. Going on a weekday morning meant barely any crowds, so I could wander freely. Walking along the stone walls with a cool breeze, I understood why this draws millions yearly. The deeper I went, the more stunning it got — traditional pavilions framed by pine trees, like something straight out of a painting.`,
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

  // Randomly select 2 out of 3 Korean examples
  const koExamples = [...examples.ko];
  const removeIdx = Math.floor(Math.random() * koExamples.length);
  koExamples.splice(removeIdx, 1);
  const exampleKoText = koExamples.map((ex, i) => `예시 ${i + 1}:\n${ex}`).join("\n\n");
  const exampleEnText = examples.en;
  const ageTone = getAgeToneInstruction(userProfile?.ageGroup ?? "30s");
  const toneDesc = style.analyzedTone;

  // Randomly select opening hook pattern
  const hookIdxKo = Math.floor(Math.random() * OPENING_HOOKS_KO.length);
  const hookIdxEn = Math.floor(Math.random() * OPENING_HOOKS_EN.length);
  const hookKo = OPENING_HOOKS_KO[hookIdxKo];
  const hookEn = OPENING_HOOKS_EN[hookIdxEn];

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

// ── Self-refine: polish pass ──

async function polishContent(
  content: GeneratedContent,
  apiKey: string,
): Promise<GeneratedContent> {
  // 2-pass self-critique: first find AI-sounding expressions, then rewrite them
  const prompt = `아래 블로그 글을 읽고 두 가지 작업을 수행하세요.

## 작업 1: AI 냄새 찾기
아래 글에서 AI가 쓴 것 같은 표현을 모두 찾으세요:
- 실제 사람이 안 쓰는 수식어 (다양한, 특별한, 완벽한, 조화로운)
- 과도한 미사여구 (분위기를 자아내다, 눈길을 사로잡다, 입안 가득 퍼지는)
- 안내형 도입 (소개해 드리겠습니다, 알아보겠습니다)
- 뻔한 마무리 (추천드립니다, 강추합니다, 마지막으로)
- 같은 표현 반복 (같은 단어가 2회 이상)
- 부자연스러운 존댓말 혼용
- 영어: "nestled", "symphony of flavors", "culinary journey", "hidden gem", "tantalizing", "delectable", "boasts", "bustling", "mouth-watering"

## 작업 2: 자연스럽게 고치기
찾은 부분만 골라서 실제 블로거처럼 자연스럽게 고쳐쓰세요.
- 글의 전체 구조, 문단 수, 길이는 유지
- [PHOTO:n] 마커 절대 제거/이동 금지
- 새로운 정보 추가 금지
- 해시태그 수정 금지
- 약한 묘사는 오감 활용한 구체적 표현으로 강화

## 한국어 글
제목: ${content.titleKo}
본문:
${content.contentKo}

## 영어 글
제목: ${content.titleEn}
본문:
${content.contentEn}

최종 수정본만 JSON으로 반환:
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
            content: "블로그 편집 전문가입니다. AI가 쓴 것 같은 표현을 찾아 실제 사람이 쓴 것처럼 고치는 것이 전문입니다. 원문의 톤, 길이, 구조를 유지하면서 어색한 표현만 다듬어주세요.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return content; // polish 실패 시 원본 반환

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

    if (!markersIntact) return content; // 마커가 손실되면 원본 반환

    // Calculate polish usage for tracking
    const polishUsage = data.usage
      ? {
          model: data.model ?? "unknown",
          inputTokens: (content.usage?.inputTokens ?? 0) + (data.usage.prompt_tokens ?? 0),
          outputTokens: (content.usage?.outputTokens ?? 0) + (data.usage.completion_tokens ?? 0),
        }
      : content.usage;

    return {
      titleKo: polished.titleKo || content.titleKo,
      contentKo: polished.contentKo || content.contentKo,
      hashtagsKo: content.hashtagsKo, // 해시태그는 수정 안 함
      titleEn: polished.titleEn || content.titleEn,
      contentEn: polished.contentEn || content.contentEn,
      hashtagsEn: content.hashtagsEn,
      usage: polishUsage,
    };
  } catch {
    return content; // 어떤 에러든 원본 반환
  } finally {
    clearTimeout(timeout);
  }
}

// ── Provider-agnostic generation call ──

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
  const result = await polishContent(draft, apiKey);

  onProgress?.("done", "완료!");
  return result;
}
