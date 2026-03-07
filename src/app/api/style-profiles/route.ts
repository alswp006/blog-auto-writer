import { type NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";
import {
  getSystemPresets,
  getByUserId,
  create as createStyleProfile,
} from "@/lib/models/styleProfile";
import { validateCreateStyleProfile } from "@/lib/validators/styleProfile";
import { analyzeTone } from "@/lib/style/analyzeTone";
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

export async function POST(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "Request body must be valid JSON"
    );
  }

  const validation = validateCreateStyleProfile(body);
  if (!validation.valid) {
    return jsonError(
      400,
      validation.error.code,
      validation.error.message,
      validation.error.fields
    );
  }

  const { name, sampleTexts } = validation.data;
  const analyzedTone = analyzeTone(sampleTexts);

  const styleProfile = createStyleProfile({
    userId: auth.userId,
    name,
    sampleTexts,
    analyzedTone,
  });

  return NextResponse.json(
    { styleProfile },
    { status: 201 }
  );
}
