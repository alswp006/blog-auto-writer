import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as platformConnectionModel from "@/lib/models/platformConnection";

// Save Medium connection
export async function POST(request: NextRequest) {
  const auth = requireAuthUser(request);
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

  // Verify token against Medium API
  const meRes = await fetch("https://api.medium.com/v1/me", {
    headers: {
      Authorization: `Bearer ${integrationToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!meRes.ok) {
    return NextResponse.json({ error: "Medium 토큰이 유효하지 않습니다" }, { status: 400 });
  }

  const meData = await meRes.json();
  const mediumUser = meData.data;

  const connection = platformConnectionModel.upsert(auth.userId, "medium", {
    accessToken: integrationToken,
    platformUserId: mediumUser.id,
    platformUsername: mediumUser.username,
  });

  return NextResponse.json({
    connection: {
      id: connection.id,
      platform: connection.platform,
      platformUsername: connection.platformUsername,
      connectedAt: connection.connectedAt,
    },
  });
}

// Disconnect Medium
export async function DELETE(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  platformConnectionModel.remove(auth.userId, "medium");
  return NextResponse.json({ success: true });
}
