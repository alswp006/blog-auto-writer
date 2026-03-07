import { type NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";
import { getById } from "@/lib/models/styleProfile";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) {
    return jsonError(404, "NOT_FOUND", "Style profile not found");
  }

  const profile = await getById(numericId);
  if (!profile) {
    return jsonError(404, "NOT_FOUND", "Style profile not found");
  }

  if (!profile.isSystemPreset && profile.userId !== auth.userId) {
    return jsonError(404, "NOT_FOUND", "Style profile not found");
  }

  const { userId: _userId, ...rest } = profile;
  void _userId;

  return NextResponse.json({ styleProfile: rest });
}
