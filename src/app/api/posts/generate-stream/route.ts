import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import * as placeModel from "@/lib/models/place";
import * as menuItemModel from "@/lib/models/menuItem";
import * as photoModel from "@/lib/models/photo";
import * as styleProfileModel from "@/lib/models/styleProfile";
import * as userProfileModel from "@/lib/models/userProfile";
import { generateBlogPost } from "@/lib/ai/generate";
import { enrichPlace } from "@/lib/ai/enrich";
import { researchPlace } from "@/lib/ai/agentResearch";
import { describePhotosForGeneration } from "@/lib/ai/photoDescribe";
import * as apiUsageModel from "@/lib/models/apiUsage";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: "Invalid request body" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const { placeId, styleProfileId, memo, isRevisit } = body as {
    placeId?: number;
    styleProfileId?: number;
    memo?: string;
    isRevisit?: boolean;
  };

  if (!placeId || !styleProfileId) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: "placeId and styleProfileId are required" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const place = await placeModel.getById(placeId);
  if (!place) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: "Place not found" })}\n\n`,
      { status: 404, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const style = await styleProfileModel.getById(styleProfileId);
  if (!style) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: "Style profile not found" })}\n\n`,
      { status: 404, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("progress", { step: "preparing", message: "데이터 준비 중..." });

        // Clean up stale drafts (failed generations older than 24h)
        await postModel.cleanupStaleDrafts(auth.userId);

        const post = await postModel.create({
          userId: auth.userId,
          placeId,
          styleProfileId,
          isRevisit: !!isRevisit,
        });

        send("progress", { step: "loading", message: "장소 정보 로딩 중...", postId: post.id });

        const menuItems = await menuItemModel.listByPlace(placeId);
        const photos = await photoModel.listPhotos(placeId);
        const userProfile = await userProfileModel.getByUserId(auth.userId);
        const userMemo = typeof memo === "string" ? memo : (place.memo ?? "");

        // Dynamic user examples
        const pastPosts = await postModel.listRecentGenerated(auth.userId, place.category, post.id, 2);
        let pastExcerpts: string | undefined;
        if (pastPosts.length > 0) {
          const excerpts = pastPosts.map((pp, i) => {
            const excerpt = (pp.contentKo ?? "").replace(/\[PHOTO:\d+\]/g, "").slice(0, 400);
            return `예시 ${i + 1} (${pp.titleKo ?? "이전 글"}):\n"${excerpt}..."`;
          });
          pastExcerpts = excerpts.join("\n\n");
        }

        // ── Pipeline enrichment: enrich + research + photo describe (parallel) ──
        send("progress", { step: "enriching", message: "장소 정보 보강 및 사진 분석 중..." });

        const [enrichedPlace, placeInsight, photoDescriptions] = await Promise.all([
          enrichPlace(place.name, place.address).catch(() => ({
            naverCategory: null, roadAddress: null, blogExcerpts: [], blogFullTexts: [], blogKeywords: [],
          })),
          researchPlace(place.name, place.category, place.address).catch(() => ({
            popularMenus: [], atmosphere: null, tips: [], nearbyLandmarks: [],
            recentTrends: null, visitorSentiment: null, bestPhotoSpots: [], rawSources: [],
          })),
          describePhotosForGeneration(photos).catch(() => []),
        ]);

        const generated = await generateBlogPost(
          place, menuItems, photos, style, userProfile, userMemo, !!isRevisit, pastExcerpts,
          enrichedPlace, placeInsight, photoDescriptions,
          (step, message) => send("progress", { step, message }),
        );

        // Record API usage
        if (generated.usage) {
          const cost = apiUsageModel.calculateCost(generated.usage.model, generated.usage.inputTokens, generated.usage.outputTokens);
          await apiUsageModel.recordUsage(auth.userId, generated.usage.model, generated.usage.inputTokens, generated.usage.outputTokens, cost);
        }

        send("progress", { step: "saving", message: "저장 중..." });
        const updated = await postModel.updateGenerated(post.id, generated);

        send("complete", { post: updated });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Generation failed";
        send("error", { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
