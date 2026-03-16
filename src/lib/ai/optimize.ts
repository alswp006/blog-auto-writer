/**
 * Platform-specific SEO optimization — rewrites base content for each platform's SEO strategy.
 * Reuses the same OpenAI call pattern as callOpenAISingle in generate.ts.
 */

type Platform = "naver" | "tistory" | "medium";
type Lang = "ko" | "en";

type OptimizeInput = {
  platform: Platform;
  lang: Lang;
  baseTitle: string;
  baseContent: string;
  baseHashtags: string[];
  placeName: string;
  photoCount: number;
};

type OptimizeResult = {
  title: string;
  content: string;
  hashtags: string[];
};

// ── Platform SEO rules ──

const NAVER_RULES_KO = `## 네이버 블로그 SEO 최적화 규칙
- 총 길이: 1,500자 이상 (길수록 유리)
- 구조: 소제목(##) 사용 금지. 하나의 자연스러운 대화체 흐름으로 작성
- 키워드: 글 초반(첫 2문단)에 핵심 키워드 집중 배치, 전체에서 4~6회 자연스럽게 반복
- 사진: [PHOTO:n] 마커를 2~3문단마다 배치 (총 {photoCount}장 사용 가능)
- 해시태그: 10~15개, #붙여서 (예: #강남맛집 #서울카페)
- 톤: ~했어요, ~더라고요, ~인 것 같아요 체. 친근하고 솔직한 후기 느낌
- 문단 사이에 빈 줄 넣어서 가독성 확보`;

const NAVER_RULES_EN = `## Naver Blog SEO Rules
- Length: 1,500+ characters (longer is better for Naver ranking)
- Structure: NO subheadings (##). Write as one continuous, conversational flow
- Keywords: concentrate main keywords in first 2 paragraphs, repeat 4-6 times naturally throughout
- Photos: place [PHOTO:n] markers every 2-3 paragraphs ({photoCount} photos available)
- Hashtags: 10-15 tags with # prefix
- Tone: casual, friendly review style. Write as if talking to a friend
- Separate paragraphs with blank lines for readability`;

const TISTORY_RULES_KO = `## 티스토리(구글 SEO) 최적화 규칙
- 총 길이: 2,000자 이상
- 구조: ## H2, ### H3 소제목 계층 구조 필수. 각 소제목에 키워드 분산 배치
- 키워드: 제목, 첫 문단, 각 소제목에 타겟 키워드 포함. 전체 밀도 1~2%
- 사진: [PHOTO:n] 마커에 설명적 alt text 가이드 추가 (총 {photoCount}장)
- 해시태그: 5~10개, 검색 유입 키워드 중심 (짧고 구체적)
- 톤: 정보 전달형. ~합니다, ~입니다 체. 객관적이고 신뢰감 있게
- 각 H2 섹션은 하나의 핵심 정보를 다루도록 구성`;

const TISTORY_RULES_EN = `## Tistory (Google SEO) Optimization Rules
- Length: 2,000+ characters
- Structure: MUST use ## H2, ### H3 heading hierarchy. Distribute keywords across headings
- Keywords: include target keyword in title, first paragraph, and each subheading. 1-2% density
- Photos: place [PHOTO:n] markers with descriptive alt text guidance ({photoCount} photos)
- Hashtags: 5-10 tags, focused on search-intent keywords (short, specific)
- Tone: informative, professional. Objective and trustworthy
- Each H2 section should cover one core piece of information`;

const MEDIUM_RULES_KO = `## Medium 최적화 규칙
- 총 길이: 1,000단어 이상 (Medium 알고리즘은 7분 읽기 선호)
- 구조: Subheading + narrative 형식. ## 소제목으로 구분하되 에세이 흐름 유지
- 키워드: 자연스러운 배치. 키워드 스터핑 절대 금지
- 사진: 핵심 3~5장만 사용. [PHOTO:n] 마커를 주요 포인트에만 배치
- 해시태그: 5개 이내, 넓은 카테고리 (예: Food, Travel, Seoul)
- 톤: Professional narrative. 개인 경험 + 유용한 정보 균형
- Hook: 첫 문장에서 독자의 관심을 확 끌어야 함`;

const MEDIUM_RULES_EN = `## Medium Optimization Rules
- Length: 1,000+ words (Medium algorithm favors ~7 min reads)
- Structure: Subheadings + narrative flow. Use ## to break sections but maintain essay-like flow
- Keywords: natural placement only. NEVER keyword-stuff
- Photos: use only 3-5 key photos. Place [PHOTO:n] markers at major points only
- Hashtags: 5 or fewer, broad categories (e.g., Food, Travel, Seoul)
- Tone: Professional narrative. Balance personal experience with useful information
- Hook: first sentence must grab reader attention immediately`;

function getPlatformRules(platform: Platform, lang: Lang, photoCount: number): string {
  const rulesMap: Record<string, string> = {
    "naver-ko": NAVER_RULES_KO,
    "naver-en": NAVER_RULES_EN,
    "tistory-ko": TISTORY_RULES_KO,
    "tistory-en": TISTORY_RULES_EN,
    "medium-ko": MEDIUM_RULES_KO,
    "medium-en": MEDIUM_RULES_EN,
  };
  return rulesMap[`${platform}-${lang}`].replace(/\{photoCount\}/g, String(photoCount));
}

function buildSystemMessage(platform: Platform, lang: Lang, photoCount: number): string {
  const rules = getPlatformRules(platform, lang, photoCount);
  const langInstr = lang === "ko"
    ? "한국어로 작성하세요."
    : "Write in English.";

  return `You are a blog SEO optimization specialist. Your task is to rewrite an existing blog post to maximize SEO performance on a specific platform.

${rules}

## CRITICAL CONSTRAINTS
- PRESERVE all factual information: prices, addresses, menu names, ratings — do NOT alter facts
- PRESERVE all [PHOTO:n] markers — you may reposition them but never remove or add new ones
- The rewritten content must cover the same topics and information as the original
- ${langInstr}

## OUTPUT FORMAT
Return a JSON object with:
- "title": optimized title string
- "content": optimized content string (with [PHOTO:n] markers preserved)
- "hashtags": array of hashtag strings (without # prefix)`;
}

function buildPrompt(input: OptimizeInput): string {
  const hashtagStr = input.baseHashtags.map(h => h.startsWith("#") ? h : `#${h}`).join(" ");
  return `Please rewrite the following blog post about "${input.placeName}" optimized for ${input.platform}.

## Original Title
${input.baseTitle}

## Original Content
${input.baseContent}

## Original Hashtags
${hashtagStr}

Rewrite this content following the platform-specific SEO rules. Keep all facts accurate.`;
}

export async function optimizeForPlatform(input: OptimizeInput): Promise<OptimizeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const systemMsg = buildSystemMessage(input.platform, input.lang, input.photoCount);
  const prompt = buildPrompt(input);

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
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error("AI가 빈 응답을 반환했습니다.");
  }

  let parsed: { title?: string; content?: string; hashtags?: string[] };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("AI 응답을 파싱할 수 없습니다.");
  }

  if (!parsed.title || !parsed.content) {
    throw new Error("AI 응답에 title 또는 content가 없습니다.");
  }

  return {
    title: parsed.title,
    content: parsed.content,
    hashtags: (parsed.hashtags ?? []).map((h: string) => h.replace(/^#/, "")),
  };
}
