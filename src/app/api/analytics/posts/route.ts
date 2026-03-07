import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postAnalytics from "@/lib/models/postAnalytics";
import * as publishHistoryModel from "@/lib/models/publishHistory";
import * as postModel from "@/lib/models/post";
import { getTistoryConfig } from "@/lib/publish/tistory";

export async function GET(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const topPosts = postAnalytics.getTopPosts(auth.userId);
  return NextResponse.json({ topPosts });
}

// POST: Fetch latest stats from platforms and save
export async function POST(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const posts = postModel.listByUser(auth.userId);
  const allPostIds = posts.map((p) => p.id);

  if (allPostIds.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const publishedPlatforms = publishHistoryModel.getPublishedPlatformsByPostIds(allPostIds);
  let updated = 0;

  // Try to fetch Tistory stats
  const tistoryConfig = getTistoryConfig();
  if (tistoryConfig) {
    for (const post of posts) {
      const platforms = publishedPlatforms.get(post.id) ?? [];
      if (!platforms.includes("tistory")) continue;

      // Get the published URL from history
      const history = publishHistoryModel.getByPostId(post.id);
      const tistoryEntry = history.find((h) => h.platform === "tistory" && h.status === "published" && h.publishedUrl);
      if (!tistoryEntry?.publishedUrl) continue;

      try {
        // Tistory Open API - get post stats
        // Extract post ID from URL (e.g., https://blogname.tistory.com/123 -> 123)
        const urlMatch = tistoryEntry.publishedUrl.match(/\/(\d+)$/);
        if (!urlMatch) continue;

        const tistoryPostId = urlMatch[1];
        const res = await fetch(
          `https://www.tistory.com/apis/post/read?` +
          new URLSearchParams({
            access_token: tistoryConfig.accessToken,
            blogName: tistoryConfig.blogName,
            postId: tistoryPostId,
            output: "json",
          }),
        );

        if (res.ok) {
          const data = await res.json();
          const item = data.tistory?.item;
          if (item) {
            postAnalytics.upsert(post.id, "tistory", {
              views: parseInt(item.visited ?? "0", 10),
              likes: parseInt(item.likeCount ?? "0", 10),
              comments: parseInt(item.commentCount ?? "0", 10),
            });
            updated++;
          }
        }
      } catch {
        // Non-critical, continue
      }
    }
  }

  // Medium Stats API is very limited (no public API for post stats)
  // WordPress - could use REST API to fetch views if Jetpack is installed
  // For now, manual input is the fallback for non-Tistory platforms

  const topPosts = postAnalytics.getTopPosts(auth.userId);
  return NextResponse.json({ updated, topPosts });
}
