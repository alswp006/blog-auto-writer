import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as userProfileModel from "@/lib/models/userProfile";
import * as photoModel from "@/lib/models/photo";
import sharp from "sharp";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

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

  const profile = await userProfileModel.getByUserId(auth.userId);
  if (!profile || !profile.watermarkText) {
    return NextResponse.json({ error: "No watermark text configured" }, { status: 400 });
  }

  const results: { photoId: number; filePath: string }[] = [];

  for (const photoId of photoIds) {
    const photo = await photoModel.getById(photoId);
    if (!photo) continue;

    const srcPath = path.join(process.cwd(), "public", photo.filePath);
    let buffer: Buffer;
    try {
      buffer = await readFile(srcPath);
    } catch {
      continue;
    }

    const metadata = await sharp(buffer).metadata();
    const imgWidth = metadata.width ?? 800;
    const imgHeight = metadata.height ?? 600;

    // Create watermark SVG text overlay
    const fontSize = Math.max(14, Math.round(imgWidth * 0.025));
    const padding = Math.round(fontSize * 0.8);

    const escapedText = profile.watermarkText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Position calculations
    let textAnchor: string;
    let x: number;
    let y: number;

    switch (profile.watermarkPosition) {
      case "top-left":
        textAnchor = "start";
        x = padding;
        y = padding + fontSize;
        break;
      case "top-right":
        textAnchor = "end";
        x = imgWidth - padding;
        y = padding + fontSize;
        break;
      case "bottom-left":
        textAnchor = "start";
        x = padding;
        y = imgHeight - padding;
        break;
      case "bottom-right":
      default:
        textAnchor = "end";
        x = imgWidth - padding;
        y = imgHeight - padding;
        break;
    }

    const svgOverlay = Buffer.from(
      `<svg width="${imgWidth}" height="${imgHeight}">
        <style>
          .watermark {
            font-family: Arial, Helvetica, sans-serif;
            font-size: ${fontSize}px;
            fill: rgba(255, 255, 255, 0.7);
            text-anchor: ${textAnchor};
          }
          .watermark-shadow {
            font-family: Arial, Helvetica, sans-serif;
            font-size: ${fontSize}px;
            fill: rgba(0, 0, 0, 0.4);
            text-anchor: ${textAnchor};
          }
        </style>
        <text x="${x + 1}" y="${y + 1}" class="watermark-shadow">${escapedText}</text>
        <text x="${x}" y="${y}" class="watermark">${escapedText}</text>
      </svg>`,
    );

    const watermarked = await sharp(buffer)
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .toBuffer();

    // Save as new file
    const ext = path.extname(photo.filePath) || ".jpg";
    const newFilename = `wm_${crypto.randomUUID()}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const newPath = path.join(uploadDir, newFilename);
    await writeFile(newPath, watermarked);

    // Update photo record with new file path
    const newFilePath = `/uploads/${newFilename}`;
    await photoModel.updateFilePath(photoId, newFilePath);

    results.push({ photoId, filePath: newFilePath });
  }

  return NextResponse.json({ results });
}
