/**
 * Client-side image compression using canvas.
 * Ensures file stays under Vercel's 4.5MB serverless function payload limit.
 */

const MAX_WIDTH = 1200;
const MAX_UPLOAD_SIZE = 3 * 1024 * 1024; // 3MB — safe margin under Vercel 4.5MB with FormData overhead

export async function compressImage(file: File): Promise<File> {
  // Small enough already
  if (file.size <= MAX_UPLOAD_SIZE) {
    return file;
  }

  // Try canvas compression
  const compressed = await canvasCompress(file);
  if (compressed && compressed.size <= MAX_UPLOAD_SIZE) {
    return compressed;
  }

  // Canvas failed or still too large — try with createImageBitmap (better HEIC support)
  const bitmapCompressed = await bitmapCompress(file);
  if (bitmapCompressed && bitmapCompressed.size <= MAX_UPLOAD_SIZE) {
    return bitmapCompressed;
  }

  // Last resort: return whatever is smallest
  const smallest = [compressed, bitmapCompressed, file]
    .filter((f): f is File => f !== null)
    .sort((a, b) => a.size - b.size)[0];

  if (smallest.size > 4 * 1024 * 1024) {
    throw new Error(`사진이 너무 큽니다 (${(smallest.size / 1024 / 1024).toFixed(1)}MB). 설정에서 카메라 해상도를 낮추거나 작은 사진을 사용해주세요.`);
  }

  return smallest;
}

function canvasCompress(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(url);
    const timeout = setTimeout(() => { cleanup(); resolve(null); }, 10000);

    img.onload = () => {
      cleanup();
      clearTimeout(timeout);

      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }

      ctx.drawImage(img, 0, 0, width, height);

      // Progressive quality reduction
      let quality = 0.8;
      const tryBlob = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(null); return; }
            if (blob.size > MAX_UPLOAD_SIZE && quality > 0.2) {
              quality -= 0.15;
              tryBlob();
              return;
            }
            resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality,
        );
      };
      tryBlob();
    };

    img.onerror = () => { cleanup(); clearTimeout(timeout); resolve(null); };
    img.src = url;
  });
}

async function bitmapCompress(file: File): Promise<File | null> {
  try {
    if (typeof createImageBitmap === "undefined") return null;

    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > MAX_WIDTH) {
      height = Math.round((height * MAX_WIDTH) / width);
      width = MAX_WIDTH;
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return null; }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let quality = 0.8;
    while (quality >= 0.2) {
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
      if (blob.size <= MAX_UPLOAD_SIZE) {
        return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
      }
      quality -= 0.15;
    }

    // Return lowest quality attempt
    const lastBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.2 });
    return new File([lastBlob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return null;
  }
}
