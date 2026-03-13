import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as postModel from "@/lib/models/post";
import { recordPublish } from "@/lib/models/publishHistory";
import { getTistoryConfig, publishToTistory } from "@/lib/publish/tistory";
import { getMediumConfig, publishToMedium } from "@/lib/publish/medium";
import { getWordPressConfig, publishToWordPress } from "@/lib/publish/wordpress";

// This endpoint is called by a cron job or external scheduler.
// Protect with a secret token to prevent unauthorized access.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const duePosts = await postModel.listDueForPublish();
  const results: { postId: number; platform: string; success: boolean; url?: string; error?: string }[] = [];

  for (const post of duePosts) {
    const platform = post.scheduledPlatform;
    const lang = post.scheduledLang ?? "ko";

    const title = lang === "ko" ? post.titleKo : post.titleEn;
    const content = lang === "ko" ? post.contentKo : post.contentEn;
    const tags = lang === "ko" ? post.hashtagsKo : post.hashtagsEn;

    if (!title || !content || !platform) {
      // Clear schedule, can't publish without content
      await postModel.unschedule(post.id);
      results.push({ postId: post.id, platform: platform ?? "unknown", success: false, error: "Missing title or content" });
      continue;
    }

    try {
      let url: string | undefined;

      if (platform === "tistory") {
        const config = getTistoryConfig();
        if (!config) throw new Error("Tistory not configured");
        const result = await publishToTistory(config, title, content, tags);
        url = result.url;
      } else if (platform === "medium") {
        const config = getMediumConfig();
        if (!config) throw new Error("Medium not configured");
        const result = await publishToMedium(config, title, content, tags);
        url = result.url;
      } else if (platform === "wordpress") {
        const config = getWordPressConfig();
        if (!config) throw new Error("WordPress not configured");
        const result = await publishToWordPress(config, title, content, tags);
        url = result.url;
      } else if (platform === "naver") {
        // Naver doesn't have API publish — skip
        await postModel.unschedule(post.id);
        results.push({ postId: post.id, platform, success: false, error: "Naver does not support API publishing" });
        continue;
      }

      // Record success
      await recordPublish(
        post.id,
        platform as "tistory" | "medium" | "wordpress" | "naver",
        lang as "ko" | "en",
        url,
      );
      await postModel.unschedule(post.id);
      results.push({ postId: post.id, platform, success: true, url });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await recordPublish(
        post.id,
        platform as "tistory" | "medium" | "wordpress" | "naver",
        lang as "ko" | "en",
        undefined,
        errorMsg,
      );
      await postModel.unschedule(post.id);
      results.push({ postId: post.id, platform, success: false, error: errorMsg });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
