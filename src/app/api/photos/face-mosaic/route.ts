import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as photoModel from "@/lib/models/photo";
import * as placeModel from "@/lib/models/place";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { resolveFilePath, getWritePath } from "@/lib/storage";
import { detectAndMosaicFaces } from "@/lib/ai/faceMosaic";

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const photoIds = body.photoIds as number[] | undefined;
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return NextResponse.json({ error: "photoIds required" }, { status: 400 });
  }

  if (photoIds.length > 20) {
    return NextResponse.json({ error: "Maximum 20 photos" }, { status: 400 });
  }

  if (!process.env.GOOGLE_CLOUD_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_CLOUD_API_KEY 환경변수가 설정되지 않았습니다" },
      { status: 500 },
    );
  }

  const results: { photoId: number; filePath: string; faceCount: number }[] = [];
  let totalFaces = 0;
  let skipped = 0;

  for (const photoId of photoIds) {
    const photo = await photoModel.getById(photoId);
    if (!photo) continue;
    const place = await placeModel.getById(photo.placeId);
    if (!place || place.userId !== auth.userId) continue;

    const srcPath = resolveFilePath(photo.filePath);
    if (!srcPath) continue;

    let buffer: Buffer;
    try {
      buffer = await readFile(srcPath);
    } catch {
      continue;
    }

    try {
      const result = await detectAndMosaicFaces(buffer);

      if (!result.processed) {
        skipped++;
        continue;
      }

      // Save as new file
      const ext = path.extname(photo.filePath) || ".jpg";
      const newFilename = `fm_${crypto.randomUUID()}${ext}`;
      const newPath = getWritePath(`/uploads/${newFilename}`);
      await writeFile(newPath, result.buffer);

      // Update photo record
      const newFilePath = `/uploads/${newFilename}`;
      await photoModel.updateFilePath(photoId, newFilePath);

      totalFaces += result.faceCount;
      results.push({ photoId, filePath: newFilePath, faceCount: result.faceCount });
    } catch (err) {
      console.error(`Face mosaic failed for photo ${photoId}:`, err);
    }
  }

  return NextResponse.json({
    results,
    totalFaces,
    processed: results.length,
    skipped,
  });
}
