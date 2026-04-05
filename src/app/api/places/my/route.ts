import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as placeModel from "@/lib/models/place";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const places = await placeModel.listByUser(auth.userId);

  if (places.length === 0) {
    return NextResponse.json({ places: [] });
  }

  // Batch count queries instead of N+1
  const placeIds = places.map((p) => p.id);
  const placeholders = placeIds.map(() => "?").join(",");

  const [photoCounts, menuCounts] = await Promise.all([
    query<{ place_id: number; cnt: number }>(
      `SELECT place_id, COUNT(*) as cnt FROM photos WHERE place_id IN (${placeholders}) GROUP BY place_id`,
      ...placeIds,
    ),
    query<{ place_id: number; cnt: number }>(
      `SELECT place_id, COUNT(*) as cnt FROM menu_items WHERE place_id IN (${placeholders}) GROUP BY place_id`,
      ...placeIds,
    ),
  ]);

  const photoMap = new Map(photoCounts.map((r) => [r.place_id, r.cnt]));
  const menuMap = new Map(menuCounts.map((r) => [r.place_id, r.cnt]));

  const result = places.map((place) => ({
    ...place,
    photoCount: photoMap.get(place.id) ?? 0,
    menuItemCount: menuMap.get(place.id) ?? 0,
  }));

  return NextResponse.json({ places: result });
}
