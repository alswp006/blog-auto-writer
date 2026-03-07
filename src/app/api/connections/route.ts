import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as platformConnectionModel from "@/lib/models/platformConnection";

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const connections = await platformConnectionModel.listByUser(auth.userId);

  // Mask tokens in response
  const masked = connections.map((c) => ({
    id: c.id,
    platform: c.platform,
    blogName: c.blogName,
    platformUsername: c.platformUsername,
    connectedAt: c.connectedAt,
    hasToken: !!c.accessToken,
  }));

  return NextResponse.json({ connections: masked });
}
