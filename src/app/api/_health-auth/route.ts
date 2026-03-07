import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true });
}
