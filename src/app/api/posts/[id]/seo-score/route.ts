import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import { query } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = await postModel.getById(postId);
  if (!post || post.userId !== auth.userId) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const lang = (url.searchParams.get("lang") ?? "ko") as "ko" | "en";

  const title = lang === "ko" ? post.titleKo : post.titleEn;
  const content = lang === "ko" ? post.contentKo : post.contentEn;
  const hashtags = lang === "ko" ? post.hashtagsKo : post.hashtagsEn;

  if (!title || !content) {
    return NextResponse.json({ error: "No content to analyze" }, { status: 400 });
  }

  const photoRows = await query<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM photos WHERE place_id = ?",
    post.placeId,
  );
  const photoCount = photoRows[0]?.cnt ?? 0;

  const placeRows = await query<{ name: string }>(
    "SELECT name FROM places WHERE id = ?",
    post.placeId,
  );
  const placeName = placeRows[0]?.name ?? "";

  const breakdown: {
    category: string;
    score: number;
    max: number;
    detail: string;
    tips: string[];
  }[] = [];
  let totalScore = 0;
  let maxTotal = 0;

  // 1. Title length
  const titleLen = title.length;
  const titleOptimal = lang === "ko" ? (titleLen >= 20 && titleLen <= 40) : (titleLen >= 30 && titleLen <= 70);
  const titleScore = titleOptimal ? 15 : titleLen > 0 ? 8 : 0;
  breakdown.push({
    category: "제목 길이",
    score: titleScore,
    max: 15,
    detail: `${titleLen}자`,
    tips: titleOptimal ? [] : [lang === "ko" ? "20~40자가 최적입니다" : "30~70자가 최적입니다"],
  });
  totalScore += titleScore;
  maxTotal += 15;

  // 2. Title keyword
  const titleHasKeyword = placeName ? title.includes(placeName) : false;
  const titleKeyScore = titleHasKeyword ? 10 : 0;
  breakdown.push({
    category: "제목 키워드",
    score: titleKeyScore,
    max: 10,
    detail: titleHasKeyword ? `"${placeName}" 포함` : `"${placeName}" 미포함`,
    tips: titleHasKeyword ? [] : ["제목에 장소명을 포함하세요"],
  });
  totalScore += titleKeyScore;
  maxTotal += 10;

  // 3. Content length
  const contentLen = content.length;
  const minLen = lang === "ko" ? 2500 : 1500;
  const optimalLen = lang === "ko" ? 3500 : 2000;
  const contentLenScore = contentLen >= optimalLen ? 20 : contentLen >= minLen ? 14 : contentLen >= minLen * 0.5 ? 8 : 3;
  breakdown.push({
    category: "본문 분량",
    score: contentLenScore,
    max: 20,
    detail: `${contentLen.toLocaleString()}자`,
    tips: contentLen < minLen ? [`최소 ${minLen.toLocaleString()}자 이상 권장`] : [],
  });
  totalScore += contentLenScore;
  maxTotal += 20;

  // 4. Paragraph structure
  const paragraphs = content.split("\n\n").filter((p) => p.trim().length > 0);
  const avgPLen = paragraphs.reduce((s, p) => s + p.length, 0) / Math.max(paragraphs.length, 1);
  const goodStructure = paragraphs.length >= 4 && avgPLen >= 80 && avgPLen <= 400;
  const structScore = goodStructure ? 10 : paragraphs.length >= 3 ? 6 : 3;
  breakdown.push({
    category: "문단 구조",
    score: structScore,
    max: 10,
    detail: `${paragraphs.length}개 문단, 평균 ${Math.round(avgPLen)}자`,
    tips: paragraphs.length < 4 ? ["4개 이상의 문단으로 나누세요"] : avgPLen > 400 ? ["문단을 더 나눠보세요"] : [],
  });
  totalScore += structScore;
  maxTotal += 10;

  // 5. Photos
  const photoScore = photoCount >= 5 ? 15 : photoCount >= 3 ? 10 : photoCount >= 1 ? 5 : 0;
  breakdown.push({
    category: "사진",
    score: photoScore,
    max: 15,
    detail: `${photoCount}장`,
    tips: photoCount < 3 ? ["3장 이상의 사진 추가 권장"] : photoCount < 5 ? ["5장 이상이면 더 좋습니다"] : [],
  });
  totalScore += photoScore;
  maxTotal += 15;

  // 6. Hashtags (Naver prefers 10-15 for better indexing)
  const tagCount = hashtags.length;
  const tagOptimal = lang === "ko" ? (tagCount >= 8 && tagCount <= 15) : (tagCount >= 3 && tagCount <= 7);
  const tagScore = tagOptimal ? 10 : tagCount >= 5 ? 7 : tagCount > 0 ? 4 : 0;
  breakdown.push({
    category: "해시태그",
    score: tagScore,
    max: 10,
    detail: `${tagCount}개`,
    tips: tagCount === 0 ? ["해시태그를 추가하세요"] : !tagOptimal ? [lang === "ko" ? "네이버는 8~15개가 최적 (롱테일 포함)" : "3~7개 최적"] : [],
  });
  totalScore += tagScore;
  maxTotal += 10;

  // 7. Keyword density
  const kwCount = placeName ? (content.match(new RegExp(placeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length : 0;
  const kwDensity = placeName ? kwCount / (contentLen / 100) : 0;
  const kwScore = kwDensity >= 0.3 && kwDensity <= 2 ? 10 : kwCount >= 1 ? 5 : 0;
  breakdown.push({
    category: "키워드 밀도",
    score: kwScore,
    max: 10,
    detail: `"${placeName}" ${kwCount}회`,
    tips: kwCount === 0 ? ["본문에 장소명을 포함하세요"] : kwDensity > 2 ? ["장소명 반복이 과합니다"] : [],
  });
  totalScore += kwScore;
  maxTotal += 10;

  // 8. Sentence variety
  const sentences = content.split(/[.!?。]\s*/).filter((s) => s.trim().length > 5);
  const sLens = sentences.map((s) => s.length);
  const avgSLen = sLens.reduce((a, b) => a + b, 0) / Math.max(sentences.length, 1);
  const variance = sLens.reduce((sum, l) => sum + Math.pow(l - avgSLen, 2), 0) / Math.max(sentences.length, 1);
  const variety = Math.sqrt(variance);
  const varietyScore = variety > 15 ? 10 : variety > 8 ? 7 : 3;
  breakdown.push({
    category: "문장 다양성",
    score: varietyScore,
    max: 10,
    detail: `평균 ${Math.round(avgSLen)}자, 편차 ${Math.round(variety)}`,
    tips: variety <= 8 ? ["짧은 감탄문과 긴 서술문을 섞어보세요"] : [],
  });
  totalScore += varietyScore;
  maxTotal += 10;

  // 9. Long-tail keywords (2+ word hashtags)
  const longTailTags = hashtags.filter((t) => {
    const clean = t.replace(/^#/, "");
    return clean.length >= 4 && /[가-힣]{2,}[가-힣]{2,}/.test(clean);
  });
  const longTailScore = longTailTags.length >= 3 ? 5 : longTailTags.length >= 1 ? 3 : 0;
  breakdown.push({
    category: "롱테일 키워드",
    score: longTailScore,
    max: 5,
    detail: `${longTailTags.length}개`,
    tips: longTailTags.length < 3 ? ["'강남역맛집', '혼밥추천' 같은 복합 키워드를 추가하세요"] : [],
  });
  totalScore += longTailScore;
  maxTotal += 5;

  // 10. Photo in first 800 chars (Naver rewards early visual content)
  const firstPhotoPos = content.indexOf("[PHOTO:");
  const earlyPhotoScore = firstPhotoPos >= 0 && firstPhotoPos <= 800 ? 5 : firstPhotoPos >= 0 ? 2 : 0;
  breakdown.push({
    category: "첫 사진 위치",
    score: earlyPhotoScore,
    max: 5,
    detail: firstPhotoPos >= 0 ? `${firstPhotoPos}자 위치` : "사진 마커 없음",
    tips: firstPhotoPos < 0 ? ["본문에 사진을 배치하세요"] : firstPhotoPos > 800 ? ["첫 사진을 800자 이내에 배치하면 체류시간이 늘어납니다"] : [],
  });
  totalScore += earlyPhotoScore;
  maxTotal += 5;

  const overallScore = Math.round((totalScore / maxTotal) * 100);

  return NextResponse.json({
    score: overallScore,
    grade: overallScore >= 85 ? "A" : overallScore >= 70 ? "B" : overallScore >= 50 ? "C" : "D",
    breakdown,
  });
}
