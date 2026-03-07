import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as placeModel from "@/lib/models/place";

export async function POST(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, category, address, rating, memo } = body as {
    name?: string;
    category?: string;
    address?: string;
    rating?: number;
    memo?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const validCategories = ["restaurant", "cafe", "accommodation", "attraction"];
  if (!category || !validCategories.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    const place = placeModel.create({
      name: name.trim(),
      category: category as "restaurant" | "cafe" | "accommodation" | "attraction",
      address: address?.trim() || null,
      rating: rating != null ? Number(rating) : null,
      memo: memo?.trim() || null,
    });

    return NextResponse.json({ place }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create place";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const places = placeModel.list();
  return NextResponse.json({ places });
}
