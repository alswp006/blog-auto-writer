import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as menuItemModel from "@/lib/models/menuItem";
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

  const { placeId, name, priceKrw } = body as {
    placeId?: number;
    name?: string;
    priceKrw?: number;
  };

  if (!placeId || !name?.trim()) {
    return NextResponse.json({ error: "placeId and name are required" }, { status: 400 });
  }

  const place = placeModel.getById(placeId);
  if (!place) {
    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }

  try {
    const item = menuItemModel.create({
      placeId,
      name: name.trim(),
      priceKrw: priceKrw ?? 0,
    });
    return NextResponse.json({ menuItem: item }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create menu item";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
