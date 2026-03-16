/**
 * Client-side image compression using canvas.
 * Resizes to maxWidth and compresses as JPEG to stay under Vercel's 4.5MB limit.
 */

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.8;
const TARGET_SIZE = 4 * 1024 * 1024; // 4MB target (Vercel limit is 4.5MB)

export async function compressImage(file: File): Promise<File> {
  // Skip if already small enough
  if (file.size <= TARGET_SIZE) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if wider than MAX_WIDTH
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // fallback to original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Try progressively lower quality until under target size
      let quality = JPEG_QUALITY;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            if (blob.size > TARGET_SIZE && quality > 0.3) {
              quality -= 0.1;
              tryCompress();
              return;
            }
            const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
            const newName = file.name.replace(`.${ext}`, ".jpg");
            resolve(new File([blob], newName, { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality,
        );
      };
      tryCompress();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Can't decode (e.g. HEIC on some browsers) — send original, let server handle
      resolve(file);
    };

    img.src = url;
  });
}
