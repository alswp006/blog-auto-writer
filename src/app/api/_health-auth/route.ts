import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";

export function GET(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true });
}
