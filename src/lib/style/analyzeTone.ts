/**
 * MVP heuristic for analyzing writing tone from sample texts.
 * Returns a non-null object with tone, formality, and emotion properties.
 */
export function analyzeTone(sampleTexts: string[]): Record<string, string> {
  if (!sampleTexts || sampleTexts.length === 0) {
    return {
      tone: "neutral",
      formality: "medium",
      emotion: "neutral",
    };
  }

  const combined = sampleTexts.join(" ").toLowerCase();

  // Count casual markers
  const casualMarkers = [
    "정말",
    "솔직히",
    "진짜",
    "완전",
    "되게",
    "막",
    "그냥",
    "ㅎㅎ",
    "ㅋㅋ",
    "!",
  ];
  const casualCount = casualMarkers.filter((m) =>
    combined.includes(m)
  ).length;

  // Count formal markers
  const formalMarkers = [
    "분석",
    "분석하다",
    "심층",
    "데이터",
    "객관적",
    "제시",
    "본",
    "포스팅",
    "합니다",
  ];
  const formalCount = formalMarkers.filter((m) =>
    combined.includes(m)
  ).length;

  // Count emotional markers
  const emotionalMarkers = ["!", "좋아", "재미", "신나", "행복"];
  const emotionalCount = emotionalMarkers.filter((m) =>
    combined.includes(m)
  ).length;

  // Determine formality
  let formality = "medium";
  if (formalCount > casualCount * 1.5) {
    formality = "high";
  } else if (casualCount > formalCount * 1.5) {
    formality = "low";
  }

  // Determine emotion
  let emotion = "neutral";
  if (emotionalCount > 2) {
    emotion = "warm";
  } else if (combined.includes("주의") || combined.includes("주의")) {
    emotion = "cautious";
  }

  // Determine tone
  let tone = "neutral";
  if (formalCount > casualCount) {
    tone = "detailed";
  } else if (casualCount > formalCount) {
    tone = "casual";
  }

  return {
    tone,
    formality,
    emotion,
  };
}
