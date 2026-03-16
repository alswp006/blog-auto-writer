/**
 * Face detection + mosaic using Google Cloud Vision API + sharp.
 *
 * Flow:
 * 1. Send image to Cloud Vision API for face detection
 * 2. Get bounding polygon coordinates for each face
 * 3. Use sharp to pixelate (mosaic) those regions
 * 4. Return processed image buffer
 */

import sharp from "sharp";

type Vertex = { x: number; y: number };

type FaceAnnotation = {
  boundingPoly: { vertices: Vertex[] };
  fdBoundingPoly: { vertices: Vertex[] };
};

/**
 * Detect faces in an image using Google Cloud Vision API.
 * Returns bounding box coordinates for each detected face.
 */
async function detectFaces(
  imageBuffer: Buffer,
  apiKey: string,
): Promise<{ x: number; y: number; width: number; height: number }[]> {
  const base64 = imageBuffer.toString("base64");

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "FACE_DETECTION", maxResults: 20 }],
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vision API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const annotations: FaceAnnotation[] =
    data.responses?.[0]?.faceAnnotations ?? [];

  return annotations.map((face) => {
    // fdBoundingPoly is tighter around the face, boundingPoly includes head
    const vertices = face.fdBoundingPoly?.vertices ?? face.boundingPoly?.vertices ?? [];
    if (vertices.length === 0) return null;

    const xs = vertices.map((v) => v.x ?? 0);
    const ys = vertices.map((v) => v.y ?? 0);
    const minX = Math.max(0, Math.min(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    // Add padding (10%) for better coverage
    const padX = Math.round((maxX - minX) * 0.1);
    const padY = Math.round((maxY - minY) * 0.1);

    return {
      x: Math.max(0, minX - padX),
      y: Math.max(0, minY - padY),
      width: maxX - minX + padX * 2,
      height: maxY - minY + padY * 2,
    };
  }).filter((f): f is { x: number; y: number; width: number; height: number } => f !== null);
}

/**
 * Apply mosaic (pixelation) to specified regions of an image.
 * Uses sharp to extract, downscale, upscale, and composite back.
 */
async function applyMosaic(
  imageBuffer: Buffer,
  regions: { x: number; y: number; width: number; height: number }[],
): Promise<Buffer> {
  if (regions.length === 0) return imageBuffer;

  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width ?? 800;
  const imgHeight = metadata.height ?? 600;

  // Build mosaic overlays for each face region
  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const region of regions) {
    // Clamp region to image bounds
    const x = Math.max(0, region.x);
    const y = Math.max(0, region.y);
    const w = Math.min(region.width, imgWidth - x);
    const h = Math.min(region.height, imgHeight - y);

    if (w <= 0 || h <= 0) continue;

    // Extract face region, shrink to ~10px, then scale back up = pixelation
    const pixelSize = Math.max(1, Math.round(Math.min(w, h) / 10));
    const mosaicBuffer = await sharp(imageBuffer)
      .extract({ left: x, top: y, width: w, height: h })
      .resize(pixelSize, pixelSize, { fit: "fill" })
      .resize(w, h, { fit: "fill", kernel: "nearest" })
      .toBuffer();

    composites.push({ input: mosaicBuffer, left: x, top: y });
  }

  if (composites.length === 0) return imageBuffer;

  return sharp(imageBuffer)
    .composite(composites)
    .toBuffer();
}

export type FaceMosaicResult = {
  faceCount: number;
  processed: boolean;
  buffer: Buffer;
};

/**
 * Detect faces and apply mosaic to an image.
 * Returns the processed image buffer and face count.
 */
export async function detectAndMosaicFaces(
  imageBuffer: Buffer,
): Promise<FaceMosaicResult> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_CLOUD_API_KEY 환경변수가 설정되지 않았습니다");
  }

  const faces = await detectFaces(imageBuffer, apiKey);

  if (faces.length === 0) {
    return { faceCount: 0, processed: false, buffer: imageBuffer };
  }

  const processedBuffer = await applyMosaic(imageBuffer, faces);
  return { faceCount: faces.length, processed: true, buffer: processedBuffer };
}
