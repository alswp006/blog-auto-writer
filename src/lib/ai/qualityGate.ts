/**
 * Content Quality Gate — heuristic-based validation of generated blog posts.
 * No AI calls; uses regex/string analysis for fast, cheap checks.
 */

import type { GeneratedContent } from "@/lib/ai/generate";

export type QualityCheckResult = {
  passed: boolean;
  score: number;          // 0-100
  issues: string[];       // human-readable failure reasons
  feedback: string;       // prompt feedback for retry
};

const AI_PATTERNS_KO = [
  "소개해 드리겠습니다",
  "소개해드리겠습니다",
  "알아보겠습니다",
  "알아볼까요",
  "살펴보겠습니다",
  "다루어 보겠습니다",
  "첫째,",
  "둘째,",
  "셋째,",
  "마지막으로,",
  "결론적으로",
  "요약하자면",
  "그럼 지금부터",
  "자 그러면",
];

/**
 * Validate generated content against quality criteria.
 * Returns a result with pass/fail, score, and retry feedback.
 */
export function validateContent(
  content: GeneratedContent,
  photoCount: number,
  placeName: string,
): QualityCheckResult {
  const issues: string[] = [];
  let score = 100;

  // ── 1. Minimum length check ──
  const koLen = (content.contentKo ?? "").length;
  const enLen = (content.contentEn ?? "").length;

  if (koLen < 2000) {
    issues.push(`한국어 글이 너무 짧습니다 (${koLen}자, 최소 2000자)`);
    score -= 20;
  } else if (koLen < 2500) {
    score -= 5; // mild penalty
  }

  if (enLen < 1200) {
    issues.push(`영어 글이 너무 짧습니다 (${enLen}자, 최소 1200자)`);
    score -= 20;
  } else if (enLen < 1500) {
    score -= 5;
  }

  // ── 2. PHOTO marker validation ──
  if (photoCount > 0) {
    const expectedMarkers = new Set<string>();
    for (let i = 0; i < photoCount; i++) {
      expectedMarkers.add(`[PHOTO:${i}]`);
    }

    const koMarkers = content.contentKo?.match(/\[PHOTO:\d+\]/g) ?? [];
    const enMarkers = content.contentEn?.match(/\[PHOTO:\d+\]/g) ?? [];

    const koMarkerSet = new Set(koMarkers);
    const enMarkerSet = new Set(enMarkers);

    // Check for missing markers in Korean
    const missingKo = [...expectedMarkers].filter((m) => !koMarkerSet.has(m));
    if (missingKo.length > 0) {
      issues.push(`한국어 글에서 사진 마커 누락: ${missingKo.join(", ")}`);
      score -= missingKo.length * 5;
    }

    // Check for missing markers in English
    const missingEn = [...expectedMarkers].filter((m) => !enMarkerSet.has(m));
    if (missingEn.length > 0) {
      issues.push(`영어 글에서 사진 마커 누락: ${missingEn.join(", ")}`);
      score -= missingEn.length * 5;
    }

    // Check for duplicate markers
    if (koMarkers.length !== koMarkerSet.size) {
      issues.push("한국어 글에 중복 사진 마커가 있습니다");
      score -= 10;
    }
    if (enMarkers.length !== enMarkerSet.size) {
      issues.push("영어 글에 중복 사진 마커가 있습니다");
      score -= 10;
    }
  }

  // ── 3. AI pattern detection ──
  const koContent = content.contentKo ?? "";
  const detectedPatterns: string[] = [];
  for (const pattern of AI_PATTERNS_KO) {
    if (koContent.includes(pattern)) {
      detectedPatterns.push(pattern);
    }
  }
  if (detectedPatterns.length > 0) {
    issues.push(`AI스러운 표현 감지: "${detectedPatterns.join('", "')}"`);
    score -= detectedPatterns.length * 5;
  }

  // Check for numbered lists (1. 2. 3.)
  const numberedListMatch = koContent.match(/^\d+\.\s/gm);
  if (numberedListMatch && numberedListMatch.length >= 3) {
    issues.push("번호 매기기(1. 2. 3.) 패턴이 감지되었습니다");
    score -= 15;
  }

  // Check for markdown headings
  const headingMatch = koContent.match(/^#{1,3}\s/gm);
  if (headingMatch && headingMatch.length > 0) {
    issues.push("소제목(## ###) 패턴이 감지되었습니다");
    score -= 10;
  }

  // ── 4. Place name mention ──
  if (!koContent.includes(placeName)) {
    issues.push("한국어 글에 장소명이 언급되지 않았습니다");
    score -= 10;
  }

  // ── 5. Hashtag count ──
  const koHashtags = Array.isArray(content.hashtagsKo) ? content.hashtagsKo : [];
  const enHashtags = Array.isArray(content.hashtagsEn) ? content.hashtagsEn : [];

  if (koHashtags.length < 5) {
    issues.push(`한국어 해시태그 부족 (${koHashtags.length}개, 최소 5개)`);
    score -= 5;
  }
  if (enHashtags.length < 3) {
    issues.push(`영어 해시태그 부족 (${enHashtags.length}개, 최소 3개)`);
    score -= 5;
  }

  // ── 6. Title validation ──
  if (!content.titleKo || content.titleKo.length < 10) {
    issues.push("한국어 제목이 너무 짧습니다");
    score -= 10;
  }
  if (!content.titleEn || content.titleEn.length < 10) {
    issues.push("영어 제목이 너무 짧습니다");
    score -= 10;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Build feedback for retry
  const feedback = issues.length > 0
    ? `이전 생성 결과에서 다음 문제가 발견되었습니다. 이번에는 반드시 수정해주세요:\n${issues.map((i) => `- ${i}`).join("\n")}`
    : "";

  return {
    passed: score >= 70,
    score,
    issues,
    feedback,
  };
}
