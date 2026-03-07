import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";

// Get list of Tistory blogs for a given access token
export async function POST(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { accessToken } = body as { accessToken?: string };
  if (!accessToken) {
    return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://www.tistory.com/apis/blog/info?access_token=${encodeURIComponent(accessToken)}&output=json`,
    );

    if (!res.ok) {
      return NextResponse.json({ error: "티스토리 API 오류" }, { status: 400 });
    }

    const data = await res.json();
    const blogs = data.tistory?.item?.blogs ?? [];

    return NextResponse.json({
      blogs: blogs.map((b: Record<string, string>) => ({
        name: b.name,
        url: b.url,
        title: b.title,
      })),
    });
  } catch {
    return NextResponse.json({ error: "티스토리 블로그 목록 조회 실패" }, { status: 500 });
  }
}
