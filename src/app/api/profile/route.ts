import { type NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";
import { getByUserId, create, update } from "@/lib/models/userProfile";
import {
  validateCreateProfileInput,
  validateUpdateProfileInput,
} from "@/lib/validators/profile";

function profileToResponse(profile: any) {
  return {
    nickname: profile.nickname,
    ageGroup: profile.ageGroup,
    preferredTone: profile.preferredTone,
    primaryPlatform: profile.primaryPlatform,
    watermarkText: profile.watermarkText ?? null,
    watermarkPosition: profile.watermarkPosition ?? "bottom-right",
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const profile = await getByUserId(auth.userId);

  if (!profile) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({
    profile: profileToResponse(profile),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  // Check if profile already exists
  const existing = await getByUserId(auth.userId);
  if (existing) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "User profile already exists",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid JSON");
  }

  const validation = validateCreateProfileInput(body);
  if (!validation.valid) {
    return jsonError(
      400,
      validation.error.code,
      validation.error.message,
      validation.error.fields,
    );
  }

  const profile = await create({
    userId: auth.userId,
    nickname: validation.data.nickname,
    ageGroup: validation.data.ageGroup,
    preferredTone: validation.data.preferredTone,
    primaryPlatform: validation.data.primaryPlatform,
  });

  return NextResponse.json({ profile: profileToResponse(profile) }, { status: 200 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid JSON");
  }

  const validation = validateUpdateProfileInput(body);
  if (!validation.valid) {
    return jsonError(
      400,
      validation.error.code,
      validation.error.message,
      validation.error.fields,
    );
  }

  const updated = await update(auth.userId, {
    ...validation.data,
    watermarkText: validation.data.watermarkText,
    watermarkPosition: validation.data.watermarkPosition,
  });
  if (!updated) {
    return jsonError(404, "NOT_FOUND", "User profile not found");
  }

  return NextResponse.json({ profile: profileToResponse(updated) }, { status: 200 });
}
