import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as postModel from "@/lib/models/post";
import * as photoModel from "@/lib/models/photo";
import * as postVariantModel from "@/lib/models/postVariant";
import { recordPublish } from "@/lib/models/publishHistory";
import { getTistoryConfig, publishToTistory } from "@/lib/publish/tistory";
import { getMediumConfig, publishToMedium } from "@/lib/publish/medium";
import { getWordPressConfig, publishToWordPress } from "@/lib/publish/wordpress";
import { loadPhotoBuffers } from "@/lib/publish/photo-embed";

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
    const lang = (post.scheduledLang ?? "ko") as "ko" | "en";

    // Check for platform variant (wordpress falls back to tistory variant)
    const variantPlatform = platform === "wordpress" ? "tistory" : platform;
    const variant = (variantPlatform === "tistory" || variantPlatform === "medium" || variantPlatform === "naver")
      ? await postVariantModel.getByPostAndPlatform(post.id, variantPlatform, lang)
      : null;

    const title = variant ? variant.title : (lang === "ko" ? post.titleKo : post.titleEn);
    const content = variant ? variant.content : (lang === "ko" ? post.contentKo : post.contentEn);
    const tags = variant ? variant.hashtags : (lang === "ko" ? post.hashtagsKo : post.hashtagsEn);

    if (!title || !content || !platform) {
      // Clear schedule, can't publish without content
      await postModel.unschedule(post.id);
      results.push({ postId: post.id, platform: platform ?? "unknown", success: false, error: "Missing title or content" });
      continue;
    }

    // Load photos for embedding
    const photos = await photoModel.listPhotos(post.placeId);
    const photoBuffers = await loadPhotoBuffers(photos);

    try {
      let url: string | undefined;

      if (platform === "tistory") {
        const config = getTistoryConfig();
        if (!config) throw new Error("Tistory not configured");
        const result = await publishToTistory(config, title, content, tags, photoBuffers);
        url = result.url;
      } else if (platform === "medium") {
        const config = getMediumConfig();
        if (!config) throw new Error("Medium not configured");
        const result = await publishToMedium(config, title, content, tags, photoBuffers);
        url = result.url;
      } else if (platform === "wordpress") {
        const config = getWordPressConfig();
        if (!config) throw new Error("WordPress not configured");
        const result = await publishToWordPress(config, title, content, tags, photoBuffers);
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
        lang,
        url,
      );
      await postModel.unschedule(post.id);
      results.push({ postId: post.id, platform, success: true, url });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await recordPublish(
        post.id,
        platform as "tistory" | "medium" | "wordpress" | "naver",
        lang,
        undefined,
        errorMsg,
      );
      await postModel.unschedule(post.id);
      results.push({ postId: post.id, platform, success: false, error: errorMsg });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
