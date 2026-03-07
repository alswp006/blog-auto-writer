import { type NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import { getSystemPresets, getByUserId } from "@/lib/models/styleProfile";
import type { StyleProfile } from "@/lib/models/modelTypes";

type StyleProfileSummary = {
  id: number;
  name: string;
  isSystemPreset: boolean;
  createdAt: string;
  updatedAt: string;
};

function toSummary(profile: StyleProfile): StyleProfileSummary {
  return {
    id: profile.id,
    name: profile.name,
    isSystemPreset: profile.isSystemPreset,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const presets = getSystemPresets().map(toSummary);
  const customs = getByUserId(auth.userId).map(toSummary);

  return NextResponse.json({ presets, customs });
}
