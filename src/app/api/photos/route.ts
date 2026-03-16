import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as photoModel from "@/lib/models/photo";
import * as placeModel from "@/lib/models/place";
import { writeFile } from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import { getUploadDir } from "@/lib/storage";

const MAX_WIDTH = 1200;
const MAX_PHOTOS_PER_PLACE = 20;

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const placeIdStr = formData.get("placeId") as string | null;
    const caption = (formData.get("caption") as string | null) ?? null;
    const orderIndexStr = formData.get("orderIndex") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (!placeIdStr) {
      return NextResponse.json({ error: "placeId is required" }, { status: 400 });
    }

    const placeId = parseInt(placeIdStr, 10);
    if (isNaN(placeId)) {
      return NextResponse.json({ error: "Invalid placeId" }, { status: 400 });
    }

    const place = await placeModel.getById(placeId, auth.userId);
    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Check max photos per place
    const existingPhotos = await photoModel.listPhotos(placeId);
    if (existingPhotos.length >= MAX_PHOTOS_PER_PLACE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PHOTOS_PER_PLACE} photos per place` },
        { status: 400 },
      );
    }

    let orderIndex = orderIndexStr ? parseInt(orderIndexStr, 10) : 0;
    if (isNaN(orderIndex) || orderIndex < 0) orderIndex = 0;

    // Auto-assign next available orderIndex if not specified or conflicts
    if (orderIndex === 0 || existingPhotos.some((p) => p.orderIndex === orderIndex)) {
      const maxIdx = existingPhotos.reduce((max, p) => Math.max(max, p.orderIndex), 0);
      orderIndex = maxIdx + 1;
    }

    if (orderIndex > 20) {
      return NextResponse.json({ error: "Maximum 20 photos per place" }, { status: 400 });
    }

    // Validate file type (mobile browsers may send empty type for HEIC/HEIF)
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "";
    const imageExts = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
    if (file.type && !allowedTypes.includes(file.type) && !imageExts.includes(fileExt)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, HEIC images are allowed" },
        { status: 400 },
      );
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be under 10MB" }, { status: 400 });
    }

    // Read file buffer
    let buffer: Buffer = Buffer.from(await file.arrayBuffer());

    // Resize if width exceeds MAX_WIDTH using sharp
    const metadata = await sharp(buffer).metadata();
    if (metadata.width && metadata.width > MAX_WIDTH) {
      const resized = await sharp(buffer)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .toBuffer();
      buffer = Buffer.from(resized);
    }

    // Determine output format (keep original, but normalize HEIC to JPEG)
    let ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    if (ext === "heic" || ext === "heif") {
      try {
        const converted = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
        buffer = Buffer.from(converted);
        ext = "jpg";
      } catch {
        return NextResponse.json(
          { error: "HEIC 이미지 변환에 실패했습니다. JPEG 또는 PNG로 변환 후 업로드해주세요." },
          { status: 400 },
        );
      }
    }

    // Save file
    const filename = `${crypto.randomUUID()}.${ext}`;
    const uploadDir = await getUploadDir();
    const filePath = `${uploadDir}/${filename}`;
    await writeFile(filePath, buffer);

    const photo = await photoModel.create({
      placeId,
      filePath: `/uploads/${filename}`,
      caption: caption?.trim() || null,
      orderIndex,
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    console.error("Photo upload error:", error);
    const msg = error instanceof Error ? error.message : "Upload failed";
    if (msg.includes("UNIQUE constraint")) {
      return NextResponse.json(
        { error: "해당 순서에 이미 사진이 있습니다. 다시 시도해주세요." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: `사진 업로드 실패: ${msg}` }, { status: 500 });
  }
}
