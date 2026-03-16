import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as photoModel from "@/lib/models/photo";
import * as placeModel from "@/lib/models/place";
import { writeFile } from "fs/promises";
import crypto from "crypto";
import { getUploadDir } from "@/lib/storage";

const MAX_WIDTH = 1200;
const MAX_PHOTOS_PER_PLACE = 20;

// Dynamic import sharp — gracefully skip if unavailable
async function tryProcessImage(buffer: Buffer, ext: string): Promise<{ buffer: Buffer; ext: string }> {
  try {
    const sharp = (await import("sharp")).default;

    // HEIC → JPEG
    if (ext === "heic" || ext === "heif") {
      buffer = Buffer.from(await sharp(buffer).jpeg({ quality: 85 }).toBuffer());
      ext = "jpg";
    }

    // Resize if too wide
    const metadata = await sharp(buffer).metadata();
    if (metadata.width && metadata.width > MAX_WIDTH) {
      buffer = Buffer.from(
        await sharp(buffer).resize({ width: MAX_WIDTH, withoutEnlargement: true }).toBuffer(),
      );
    }

    return { buffer, ext };
  } catch (err) {
    console.warn("sharp processing skipped (saving original):", err instanceof Error ? err.message : err);
    // If HEIC and sharp failed, still rename ext so browser can attempt display
    if (ext === "heic" || ext === "heif") ext = "jpg";
    return { buffer, ext };
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  let debugStage = "init";
  try {
    debugStage = "formData";
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const placeIdStr = formData.get("placeId") as string | null;
    const caption = (formData.get("caption") as string | null) ?? null;
    const orderIndexStr = formData.get("orderIndex") as string | null;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }
    if (!placeIdStr) {
      return NextResponse.json({ error: "placeId가 없습니다" }, { status: 400 });
    }

    debugStage = "validate";
    const placeId = parseInt(placeIdStr, 10);
    if (isNaN(placeId)) {
      return NextResponse.json({ error: "잘못된 placeId" }, { status: 400 });
    }

    const place = await placeModel.getById(placeId, auth.userId);
    if (!place) {
      return NextResponse.json({ error: `장소를 찾을 수 없습니다 (placeId=${placeId})` }, { status: 404 });
    }

    const existingPhotos = await photoModel.listPhotos(placeId);
    if (existingPhotos.length >= MAX_PHOTOS_PER_PLACE) {
      return NextResponse.json({ error: `장소당 최대 ${MAX_PHOTOS_PER_PLACE}장` }, { status: 400 });
    }

    // Auto-assign orderIndex
    let orderIndex = orderIndexStr ? parseInt(orderIndexStr, 10) : 0;
    if (isNaN(orderIndex) || orderIndex <= 0 || existingPhotos.some((p) => p.orderIndex === orderIndex)) {
      const maxIdx = existingPhotos.reduce((max, p) => Math.max(max, p.orderIndex), 0);
      orderIndex = maxIdx + 1;
    }
    if (orderIndex > 20) {
      return NextResponse.json({ error: "장소당 최대 20장" }, { status: 400 });
    }

    // File type check (lenient — accept anything image-like)
    const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "";
    const imageExts = ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "bmp", "tiff", "tif", "avif"];
    const isImage = file.type.startsWith("image/") || imageExts.includes(fileExt);
    if (!isImage) {
      return NextResponse.json({ error: `이미지 파일이 아닙니다 (type=${file.type}, name=${file.name})` }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기 10MB 초과" }, { status: 400 });
    }

    debugStage = "readBuffer";
    const rawBuffer = Buffer.from(await file.arrayBuffer());

    debugStage = "processImage";
    let ext = fileExt || "jpg";
    const processed = await tryProcessImage(rawBuffer, ext);
    const finalBuffer = processed.buffer;
    ext = processed.ext;

    debugStage = "saveFile";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const uploadDir = await getUploadDir();
    const filePath = `${uploadDir}/${filename}`;
    await writeFile(filePath, finalBuffer);

    debugStage = "saveDB";
    const photo = await photoModel.create({
      placeId,
      filePath: `/uploads/${filename}`,
      caption: caption?.trim() || null,
      orderIndex,
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    console.error(`Photo upload error at [${debugStage}]:`, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "사진 순서 충돌 — 다시 시도해주세요" }, { status: 409 });
    }
    return NextResponse.json({ error: `[${debugStage}] ${msg}` }, { status: 500 });
  }
}
