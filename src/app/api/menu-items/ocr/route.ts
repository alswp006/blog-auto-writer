import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as apiUsageModel from "@/lib/models/apiUsage";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { image, mimeType } = body as { image: string; mimeType: string };

  if (!image || !mimeType) {
    return NextResponse.json({ error: "image (base64) and mimeType required" }, { status: 400 });
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
              text: `이 메뉴판/메뉴 사진에서 메뉴명과 가격을 읽어주세요.

## 규칙
- 메뉴명과 가격(원)을 추출하세요
- 가격이 보이지 않으면 0으로 설정
- 한국어 메뉴명 그대로 사용 (영문 병기된 경우 한국어 우선)
- 세트메뉴, 토핑, 사이드 등도 포함
- 최대 20개까지만 추출

JSON으로 응답: { "items": [{ "name": "메뉴명", "price": 15000 }, ...] }`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${image}` },
            },
          ],
        }],
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Vision API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();

    if (data.usage) {
      const model = data.model ?? "gpt-4o-mini";
      const inputTokens = data.usage.prompt_tokens ?? 0;
      const outputTokens = data.usage.completion_tokens ?? 0;
      const cost = apiUsageModel.calculateCost(model, inputTokens, outputTokens);
      await apiUsageModel.recordUsage(auth.userId, model, inputTokens, outputTokens, cost);
    }

    const content = data.choices?.[0]?.message?.content ?? "{}";
    let items: { name: string; price: number }[] = [];
    try {
      const parsed = JSON.parse(content) as { items: { name: string; price: number }[] };
      items = (parsed.items ?? []).slice(0, 20).map((item) => ({
        name: String(item.name ?? "").slice(0, 80),
        price: Math.max(0, Math.min(10000000, Number(item.price) || 0)),
      }));
    } catch {
      return NextResponse.json({ error: "AI 응답 파싱 실패" }, { status: 502 });
    }

    return NextResponse.json({ items });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "OCR failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
