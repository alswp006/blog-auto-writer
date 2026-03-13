/**
 * Generation-time photo description — calls Vision API to get
 * detailed descriptions of photos for blog writing context.
 *
 * Different from the photo analyze route (which generates short 15-40 char captions).
 * This generates rich 80-150 char descriptions focused on sensory details.
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { Photo } from "@/lib/models/modelTypes";

export type PhotoDescription = {
  orderIndex: number;
  caption: string;         // original short caption (user or auto-generated)
  richDescription: string; // detailed description for blog writing
};

/**
 * Analyze photos with Vision API to get rich descriptions.
 * Returns original captions for photos that can't be analyzed.
 * Gracefully returns empty on failure.
 */
export async function describePhotosForGeneration(
  photos: Photo[],
): Promise<PhotoDescription[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || photos.length === 0) {
    return photos.map((p) => ({
      orderIndex: p.orderIndex,
      caption: p.caption ?? "",
      richDescription: p.caption ?? "",
    }));
  }

  // Read photo files and convert to base64
  type ImageEntry = { orderIndex: number; caption: string; dataUrl: string };
  const entries: ImageEntry[] = [];

  for (const photo of photos.slice(0, 10)) {
    try {
      const publicPath = path.join(process.cwd(), "public", photo.filePath);
      if (!existsSync(publicPath)) continue;

      const buffer = await readFile(publicPath);
      const base64 = buffer.toString("base64");
      const ext = path.extname(photo.filePath).slice(1).toLowerCase();
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
        : ext === "png" ? "image/png"
        : ext === "webp" ? "image/webp"
        : "image/jpeg";

      entries.push({
        orderIndex: photo.orderIndex,
        caption: photo.caption ?? "",
        dataUrl: `data:${mime};base64,${base64}`,
      });
    } catch {
      // Skip unreadable photos
    }
  }

  if (entries.length === 0) {
    return photos.map((p) => ({
      orderIndex: p.orderIndex,
      caption: p.caption ?? "",
      richDescription: p.caption ?? "",
    }));
  }

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
            {
              type: "text",
              text: `블로그 글 작성을 위해 아래 ${entries.length}장의 사진을 상세히 묘사해주세요.

규칙:
- 각 묘사는 80~150자
- 음식: 색감, 질감, 플레이팅, 양, 그릇 특징, 김이 나는지, 소스 색상 등 시각적 디테일
- 인테리어/외관: 조명 톤, 좌석 배치, 벽면 소재, 식물/소품, 전체 분위기
- 풍경/거리: 계절감, 하늘 색, 사람들, 건물 특징
- 블로거가 이 사진을 보고 묘사할 때 쓸 수 있는 구체적 디테일에 집중
- 감정이나 평가 넣지 말고 순수한 시각 묘사만

JSON으로 응답: { "descriptions": ["묘사1", "묘사2", ...] }
사진 순서대로 작성하세요.`,
            },
            ...entries.map((e) => ({
              type: "image_url" as const,
              image_url: { url: e.dataUrl, detail: "low" as const },
            })),
          ],
        }],
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Vision API ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { descriptions: string[] };
    const descriptions = parsed.descriptions ?? [];

    // Map descriptions back to photos
    return photos.map((p) => {
      const entryIdx = entries.findIndex((e) => e.orderIndex === p.orderIndex);
      const richDesc = entryIdx >= 0 && descriptions[entryIdx]
        ? descriptions[entryIdx]
        : p.caption ?? "";
      return {
        orderIndex: p.orderIndex,
        caption: p.caption ?? "",
        richDescription: richDesc,
      };
    });
  } catch {
    // Graceful fallback — use original captions
    return photos.map((p) => ({
      orderIndex: p.orderIndex,
      caption: p.caption ?? "",
      richDescription: p.caption ?? "",
    }));
  }
}
