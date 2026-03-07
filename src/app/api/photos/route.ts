import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as photoModel from "@/lib/models/photo";
import * as placeModel from "@/lib/models/place";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const MAX_WIDTH = 1200;
const MAX_PHOTOS_PER_PLACE = 20;

export async function POST(request: NextRequest) {
  const auth = requireAuthUser(request);
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

    const place = placeModel.getById(placeId);
    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Check max photos per place
    const existingPhotos = photoModel.listPhotos(placeId);
    if (existingPhotos.length >= MAX_PHOTOS_PER_PLACE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PHOTOS_PER_PLACE} photos per place` },
        { status: 400 },
      );
    }

    const orderIndex = orderIndexStr ? parseInt(orderIndexStr, 10) : 1;
    if (isNaN(orderIndex) || orderIndex < 1 || orderIndex > 20) {
      return NextResponse.json({ error: "orderIndex must be 1-20" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!allowedTypes.includes(file.type)) {
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
      const converted = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
      buffer = Buffer.from(converted);
      ext = "jpg";
    }

    // Save file
    const filename = `${crypto.randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const photo = photoModel.create({
      placeId,
      filePath: `/uploads/${filename}`,
      caption: caption?.trim() || null,
      orderIndex,
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    if (msg.includes("UNIQUE constraint")) {
      return NextResponse.json(
        { error: "A photo with that order index already exists for this place" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
