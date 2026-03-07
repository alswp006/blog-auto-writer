import { type NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import { getByUserId } from "@/lib/models/userProfile";

export async function GET(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const profile = getByUserId(auth.userId);

  if (!profile) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({
    profile: {
      nickname: profile.nickname,
      ageGroup: profile.ageGroup,
      preferredTone: profile.preferredTone,
      primaryPlatform: profile.primaryPlatform,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
  });
}
