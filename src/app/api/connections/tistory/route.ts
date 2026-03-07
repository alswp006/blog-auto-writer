import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as platformConnectionModel from "@/lib/models/platformConnection";

// Save Tistory connection (after OAuth callback)
export async function POST(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { accessToken, blogName } = body as { accessToken?: string; blogName?: string };
  if (!accessToken) {
    return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
  }
  if (!blogName) {
    return NextResponse.json({ error: "blogName is required" }, { status: 400 });
  }

  const connection = platformConnectionModel.upsert(auth.userId, "tistory", {
    accessToken,
    blogName,
  });

  return NextResponse.json({
    connection: {
      id: connection.id,
      platform: connection.platform,
      blogName: connection.blogName,
      connectedAt: connection.connectedAt,
    },
  });
}

// Disconnect Tistory
export async function DELETE(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  platformConnectionModel.remove(auth.userId, "tistory");
  return NextResponse.json({ success: true });
}
