import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import { query } from "@/lib/db";

/**
 * GET /api/menu-items/suggestions?q=검색어
 * Returns distinct menu names + most recent price from user's past places.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const rows = await query<{ name: string; price_krw: number }>(
    `SELECT mi.name, mi.price_krw
     FROM menu_items mi
     JOIN places pl ON mi.place_id = pl.id
     WHERE pl.user_id = ?
     ${q.length > 0 ? "AND mi.name LIKE ?" : ""}
     GROUP BY mi.name
     ORDER BY MAX(mi.created_at) DESC
     LIMIT 10`,
    ...(q.length > 0 ? [auth.userId, `%${q}%`] : [auth.userId]),
  );

  return NextResponse.json({
    suggestions: rows.map((r) => ({ name: r.name, priceKrw: r.price_krw })),
  });
}
