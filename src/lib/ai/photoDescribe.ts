/**
 * Generation-time photo description — calls Vision API to get
 * detailed descriptions of photos for blog writing context.
 *
 * Supports two providers:
 * 1. Gemini Flash-Lite (preferred — faster, cheaper): set GEMINI_API_KEY
 * 2. OpenAI Vision (fallback): uses OPENAI_API_KEY
 *
 * Different from the photo analyze route (which generates short 15-40 char captions).
 * This generates rich 80-150 char descriptions focused on sensory details.
 */

import { readFile } from "fs/promises";
import path from "path";
import type { Photo } from "@/lib/models/modelTypes";
import { resolveFilePath } from "@/lib/storage";

export type PhotoDescription = {
  orderIndex: number;
  caption: string;         // original short caption (user or auto-generated)
  richDescription: string; // detailed description for blog writing
  photoType: string;       // food, exterior, interior, parking, street, menu, other
};

type ImageEntry = { orderIndex: number; caption: string; base64: string; mimeType: string };

const VISION_PROMPT = `블로그 글 작성을 위해 아래 사진을 상세히 묘사해주세요.

규칙:
- 각 묘사는 80~150자
- 먼저 사진 유형을 파악하세요: 음식, 외관/간판, 인테리어, 주차장, 주변환경/거리, 풍경, 메뉴판, 기타
- 음식/음료: 색감, 질감, 플레이팅, 양, 그릇 특징, 김이 나는지, 소스 색상 등 시각적 디테일
- 외관/간판: 건물 형태, 간판 색상과 디자인, 입구 모양, 주변 건물과의 관계
- 인테리어: 조명 톤, 좌석 배치, 벽면 소재, 식물/소품, 전체 분위기
- 주차장/주변: 주차 공간 크기, 주차 편의성이 보이는 특징, 주변 도로나 골목 모습
- 풍경/거리: 계절감, 하늘 색, 사람들, 건물 특징, 거리 분위기
- 메뉴판: 가격대, 메뉴 구성, 추천 메뉴 표시 여부
- 블로거가 이 사진을 보고 묘사할 때 쓸 수 있는 구체적 디테일에 집중
- 감정이나 평가 넣지 말고 순수한 시각 묘사만

JSON으로 응답: { "descriptions": ["묘사1", "묘사2", ...], "photoTypes": ["food", "exterior", "interior", "parking", "street", "menu", "other", ...] }
사진 순서대로 작성하세요.`;

/** Read photos from disk and convert to base64 */
async function prepareImageEntries(photos: Photo[]): Promise<ImageEntry[]> {
  const entries: ImageEntry[] = [];

  for (const photo of photos.slice(0, 10)) {
    try {
      const resolved = resolveFilePath(photo.filePath);
      if (!resolved) continue;

      const buffer = await readFile(resolved);
      const base64 = buffer.toString("base64");
      const ext = path.extname(photo.filePath).slice(1).toLowerCase();
      const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
        : ext === "png" ? "image/png"
        : ext === "webp" ? "image/webp"
        : "image/jpeg";

      entries.push({
        orderIndex: photo.orderIndex,
        caption: photo.caption ?? "",
        base64,
        mimeType,
      });
    } catch {
      // Skip unreadable photos
    }
  }

  return entries;
}

/** Parse vision API response into descriptions and photo types */
function parseVisionResponse(content: string): { descriptions: string[]; photoTypes: string[] } {
  try {
    const cleaned = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { descriptions?: string[]; photoTypes?: string[] };
    return {
      descriptions: parsed.descriptions ?? [],
      photoTypes: parsed.photoTypes ?? [],
    };
  } catch {
    return { descriptions: [], photoTypes: [] };
  }
}

// ── Gemini Flash-Lite Vision ──

async function describeWithGemini(entries: ImageEntry[]): Promise<{ descriptions: string[]; photoTypes: string[] } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_VISION_MODEL ?? "gemini-2.0-flash-lite";

  try {
    // Gemini API: parts 배열에 텍스트와 이미지를 함께 전달
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: `${entries.length}장의 사진입니다. ${VISION_PROMPT}` },
    ];

    for (const entry of entries) {
      parts.push({
        inlineData: {
          mimeType: entry.mimeType,
          data: entry.base64,
        },
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 1000,
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini Vision API error: ${response.status} - ${errText}`);
      return null;
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!content) return null;

    return parseVisionResponse(content);
  } catch (err) {
    console.error("Gemini Vision failed, will fallback to OpenAI:", err);
    return null;
  }
}

// ── OpenAI Vision (fallback) ──

async function describeWithOpenAI(entries: ImageEntry[]): Promise<{ descriptions: string[]; photoTypes: string[] } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `${entries.length}장의 사진입니다. ${VISION_PROMPT}` },
            ...entries.map((e) => ({
              type: "image_url" as const,
              image_url: { url: `data:${e.mimeType};base64,${e.base64}`, detail: "low" as const },
            })),
          ],
        }],
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Vision API ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    return parseVisionResponse(content);
  } catch {
    return null;
  }
}

// ── Main export ──

/**
 * Analyze photos with Vision API to get rich descriptions.
 * Priority: Gemini Flash-Lite (faster/cheaper) → OpenAI Vision → original captions
 */
export async function describePhotosForGeneration(
  photos: Photo[],
): Promise<PhotoDescription[]> {
  const hasAnyKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!hasAnyKey || photos.length === 0) {
    return photos.map((p) => ({
      orderIndex: p.orderIndex,
      caption: p.caption ?? "",
      richDescription: p.caption ?? "",
      photoType: "other",
    }));
  }

  const entries = await prepareImageEntries(photos);

  if (entries.length === 0) {
    return photos.map((p) => ({
      orderIndex: p.orderIndex,
      caption: p.caption ?? "",
      richDescription: p.caption ?? "",
      photoType: "other",
    }));
  }

  // Try Gemini first (faster, cheaper), fallback to OpenAI
  const result = await describeWithGemini(entries) ?? await describeWithOpenAI(entries);

  if (!result || result.descriptions.length === 0) {
    return photos.map((p) => ({
      orderIndex: p.orderIndex,
      caption: p.caption ?? "",
      richDescription: p.caption ?? "",
      photoType: "other",
    }));
  }

  const { descriptions, photoTypes } = result;

  return photos.map((p) => {
    const entryIdx = entries.findIndex((e) => e.orderIndex === p.orderIndex);
    const richDesc = entryIdx >= 0 && descriptions[entryIdx]
      ? descriptions[entryIdx]
      : p.caption ?? "";
    const pType = entryIdx >= 0 && photoTypes[entryIdx]
      ? photoTypes[entryIdx]
      : "other";
    return {
      orderIndex: p.orderIndex,
      caption: p.caption ?? "",
      richDescription: richDesc,
      photoType: pType,
    };
  });
}
