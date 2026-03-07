import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";

// Verify a Medium integration token without saving
export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { integrationToken } = body as { integrationToken?: string };
  if (!integrationToken) {
    return NextResponse.json({ error: "integrationToken is required" }, { status: 400 });
  }

  try {
    const meRes = await fetch("https://api.medium.com/v1/me", {
      headers: {
        Authorization: `Bearer ${integrationToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!meRes.ok) {
      return NextResponse.json({ error: "토큰이 유효하지 않습니다" }, { status: 400 });
    }

    const meData = await meRes.json();
    return NextResponse.json({
      valid: true,
      user: {
        id: meData.data.id,
        username: meData.data.username,
        name: meData.data.name,
      },
    });
  } catch {
    return NextResponse.json({ error: "Medium API 연결 실패" }, { status: 500 });
  }
}
