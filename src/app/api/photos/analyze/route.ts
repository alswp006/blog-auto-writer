import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import { query, execute } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  const body = await request.json();

  // Support two modes:
  // 1. photoIds: analyze already-uploaded photos (from edit page)
  // 2. images: analyze base64 images directly (from new post page)
  type ImageEntry = { index: number; content: { type: string; image_url: { url: string } } };
  const imageEntries: ImageEntry[] = [];
  let photoIdMap: number[] = []; // maps index -> photoId for DB updates

  if (body.photoIds && Array.isArray(body.photoIds)) {
    const ids = (body.photoIds as number[]).slice(0, 10);
    const placeholders = ids.map(() => "?").join(",");
    const photos = await query<{ id: number; file_path: string }>(
      `SELECT id, file_path FROM photos WHERE id IN (${placeholders})`,
      ...ids,
    );

    for (const photo of photos) {
      const publicPath = path.join(process.cwd(), "public", photo.file_path);
      if (existsSync(publicPath)) {
        const buffer = await readFile(publicPath);
        const base64 = buffer.toString("base64");
        const ext = path.extname(photo.file_path).slice(1).toLowerCase();
        const mime = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        imageEntries.push({
          index: imageEntries.length,
          content: { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        });
        photoIdMap.push(photo.id);
      }
    }
  } else if (body.images && Array.isArray(body.images)) {
    const images = (body.images as { base64: string; mimeType: string }[]).slice(0, 10);
    for (let i = 0; i < images.length; i++) {
      imageEntries.push({
        index: i,
        content: { type: "image_url", image_url: { url: `data:${images[i].mimeType};base64,${images[i].base64}` } },
      });
    }
    photoIdMap = []; // no DB updates for direct images
  }

  if (imageEntries.length === 0) {
    return NextResponse.json({ error: "No analyzable photos" }, { status: 400 });
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
              text: `아래 ${imageEntries.length}장의 사진을 분석해서 각각 블로그용 캡션을 한국어로 작성해주세요.
규칙:
- 각 캡션은 15~40자 이내
- 음식이면 색감, 플레이팅, 재료 묘사
- 인테리어/외관이면 분위기와 특징 묘사
- 풍경이면 계절감, 색감 묘사
- 자연스러운 구어체 (예: "노릇하게 구워진 삼겹살", "따뜻한 조명의 아늑한 내부")
JSON으로 응답: { "captions": ["캡션1", "캡션2", ...] }
사진 순서대로 작성하세요.`,
            },
            ...imageEntries.map((ie) => ie.content),
          ],
        }],
        max_completion_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Vision API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let captions: string[] = [];
    try {
      const parsed = JSON.parse(content) as { captions: string[] };
      captions = parsed.captions ?? [];
    } catch {
      return NextResponse.json({ error: "AI 응답 파싱 실패" }, { status: 502 });
    }

    // Update DB for uploaded photos
    const results: { index: number; photoId?: number; caption: string }[] = [];
    for (let i = 0; i < imageEntries.length; i++) {
      const caption = captions[i] ?? "";
      if (photoIdMap[i] && caption) {
        await execute("UPDATE photos SET caption = ? WHERE id = ?", caption, photoIdMap[i]);
      }
      results.push({
        index: i,
        ...(photoIdMap[i] ? { photoId: photoIdMap[i] } : {}),
        caption,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
