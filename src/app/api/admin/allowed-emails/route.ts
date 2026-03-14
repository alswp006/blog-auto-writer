import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import { isAdminEmail } from "@/lib/admin";
import { getUserById } from "@/lib/models/user";
import * as allowedEmailModel from "@/lib/models/allowedEmail";

async function requireAdmin(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return { ok: false as const, response: auth.response };

  const user = await getUserById(auth.userId);
  if (!user || !isAdminEmail(user.email)) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, userId: auth.userId };
}

/** GET — list all allowed emails */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const emails = await allowedEmailModel.list();
  return NextResponse.json({ emails });
}

/** POST — add an allowed email */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, memo } = body as { email?: string; memo?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  try {
    const added = await allowedEmailModel.add(email, memo);
    return NextResponse.json({ email: added }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "이미 등록된 이메일입니다" }, { status: 409 });
    }
    return NextResponse.json({ error: "추가 실패" }, { status: 500 });
  }
}

/** DELETE — remove an allowed email */
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const deleted = await allowedEmailModel.remove(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
