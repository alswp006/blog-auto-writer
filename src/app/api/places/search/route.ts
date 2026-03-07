import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";

type NaverSearchItem = {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
};

export async function GET(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ items: [] });
  }

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&sort=comment`,
      {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ items: [] });
    }

    const data = await res.json();
    const items: NaverSearchItem[] = (data.items ?? []).map(
      (item: Record<string, string>) => ({
        title: item.title?.replace(/<[^>]*>/g, "") ?? "",
        category: item.category ?? "",
        address: item.address ?? "",
        roadAddress: item.roadAddress ?? "",
        mapx: item.mapx ?? "",
        mapy: item.mapy ?? "",
      }),
    );

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
