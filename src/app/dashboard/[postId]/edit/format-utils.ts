import type { Photo, Place, Platform } from "./types";

export function getAbsolutePhotoUrl(filePath: string): string {
  if (filePath.startsWith("http")) return filePath;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${filePath.startsWith("/") ? "" : "/"}${filePath}`;
}

export function getPhotoAlt(p: Photo): string {
  return p.altText ?? p.caption ?? `Photo ${p.orderIndex}`;
}

export function buildPhotoImgTags(photos: Photo[], format: "html" | "markdown" | "text"): string {
  if (photos.length === 0) return "";
  if (format === "html") {
    return photos
      .map((p) => {
        const alt = getPhotoAlt(p);
        const photoUrl = getAbsolutePhotoUrl(p.filePath);
        return `<img src="${photoUrl}" alt="${alt}" style="max-width:100%;margin:12px 0;" />${p.caption ? `\n<p style="text-align:center;color:#888;font-size:14px;">${p.caption}</p>` : ""}`;
      })
      .join("\n");
  }
  if (format === "text") {
    return photos
      .filter((p) => p.caption)
      .map((p) => `(${p.caption})`)
      .join("\n");
  }
  // markdown
  return photos
    .map((p) => `![${getPhotoAlt(p)}](${getAbsolutePhotoUrl(p.filePath)})${p.caption ? `\n*${p.caption}*` : ""}`)
    .join("\n\n");
}

export function replacePhotoMarkers(
  text: string,
  format: "html" | "markdown" | "text",
  photoByIndex: Map<number, Photo>,
): string {
  return text.replace(/\[PHOTO:(\d+)\]/g, (_match, idxStr) => {
    const idx = parseInt(idxStr, 10);
    const photo = photoByIndex.get(idx);
    if (!photo) return "";
    const photoUrl = getAbsolutePhotoUrl(photo.filePath);
    if (format === "html") {
      const alt = getPhotoAlt(photo);
      return `<img src="${photoUrl}" alt="${alt}" style="max-width:100%;margin:12px 0;" />${photo.caption ? `\n<p style="text-align:center;color:#888;font-size:14px;">${photo.caption}</p>` : ""}`;
    }
    if (format === "text") {
      return photo.caption ? `\n(${photo.caption})\n` : "\n";
    }
    return `![${getPhotoAlt(photo)}](${photoUrl})${photo.caption ? `\n*${photo.caption}*` : ""}`;
  });
}

export function formatNaver(
  title: string,
  htmlParts: string[],
  tagStr: string,
  place: Place | null,
): string {
  const header = `<div style="text-align:center;margin-bottom:30px;">
<h2 style="font-size:22px;font-weight:bold;">${title}</h2>
<hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />
</div>`;
  const footer = `<hr style="border:none;border-top:1px solid #ddd;margin:30px 0 15px;" />
<p style="color:#888;font-size:14px;">${tagStr}</p>
${place ? `<p style="color:#888;font-size:13px;margin-top:8px;">📍 ${place.name}${place.category ? ` | ${place.category}` : ""}</p>` : ""}`;
  return `${header}\n${htmlParts.join("\n\n")}\n\n${footer}`;
}

export function formatTistory(
  title: string,
  htmlParts: string[],
  tagStr: string,
  place: Place | null,
): string {
  const header = `<h2 style="text-align:center;">${title}</h2>
<p>&nbsp;</p>`;
  const body = htmlParts.map((part) => {
    if (part.startsWith("<img ")) return `<div style="text-align:center;">${part}</div>`;
    return part;
  }).join("\n\n<p>&nbsp;</p>\n\n");
  const footer = `<p>&nbsp;</p>
<hr />
<p style="color:#888;font-size:14px;">${tagStr}</p>
${place ? `<p style="color:#888;font-size:13px;">📍 ${place.name}${place.category ? ` | ${place.category}` : ""}</p>` : ""}`;
  return `${header}\n\n${body}\n\n${footer}`;
}

function contentToHtmlParts(content: string): string[] {
  return content.split("\n\n").map((p) => `<p style="font-size:16px;line-height:1.8;margin-bottom:20px;">${p}</p>`);
}

export function buildNaverHtml(
  title: string,
  content: string,
  tagStr: string,
  photos: Photo[],
  place: Place | null,
  photoByIndex: Map<number, Photo>,
): string {
  const contentHasMarkers = /\[PHOTO:\d+\]/.test(content);

  if (contentHasMarkers) {
    const replaced = replacePhotoMarkers(content, "html", photoByIndex);
    const htmlParts = replaced.split("\n\n").map((p) => {
      if (p.startsWith("<img ")) return p;
      return `<p style="font-size:16px;line-height:1.8;margin-bottom:20px;">${p}</p>`;
    });
    return formatNaver(title, htmlParts, tagStr, place);
  }

  const contentParagraphs = content.split("\n\n");
  const photoBlock = buildPhotoImgTags(photos, "html");
  const insertIdx = Math.min(1, contentParagraphs.length);
  const htmlParts = contentToHtmlParts(content);
  htmlParts.splice(insertIdx, 0, photoBlock);
  return formatNaver(title, htmlParts, tagStr, place);
}

export function formatForPlatform(
  platform: Platform,
  title: string,
  content: string,
  tagStr: string,
  photos: Photo[],
  place: Place | null,
  photoByIndex: Map<number, Photo>,
): string {
  const contentHasMarkers = /\[PHOTO:\d+\]/.test(content);

  // Naver SE ONE: no HTML paste — plain text only
  if (platform === "naver") {
    if (contentHasMarkers) {
      const replaced = replacePhotoMarkers(content, "text", photoByIndex);
      return `${title}\n\n${replaced}\n\n${tagStr}${place ? `\n\n📍 ${place.name}${place.category ? ` | ${place.category}` : ""}` : ""}`;
    }
    return `${title}\n\n${content}\n\n${tagStr}${place ? `\n\n📍 ${place.name}${place.category ? ` | ${place.category}` : ""}` : ""}`;
  }

  // Tistory: HTML with absolute URL img tags
  if (platform === "tistory") {
    if (contentHasMarkers) {
      const replaced = replacePhotoMarkers(content, "html", photoByIndex);
      const htmlParts = replaced.split("\n\n").map((p) => {
        if (p.startsWith("<img ")) return p;
        return `<p style="font-size:16px;line-height:1.8;margin-bottom:20px;">${p}</p>`;
      });
      return formatTistory(title, htmlParts, tagStr, place);
    }
    const contentParagraphs = content.split("\n\n");
    const photoBlock = buildPhotoImgTags(photos, "html");
    const insertIdx = Math.min(1, contentParagraphs.length);
    const htmlParts = contentToHtmlParts(content);
    htmlParts.splice(insertIdx, 0, photoBlock);
    return formatTistory(title, htmlParts, tagStr, place);
  }

  // Medium / WordPress: markdown
  if (contentHasMarkers) {
    const replaced = replacePhotoMarkers(content, "markdown", photoByIndex);
    return `# ${title}\n\n${replaced}\n\n${tagStr}`;
  }
  const contentParagraphs = content.split("\n\n");
  const photoBlock = buildPhotoImgTags(photos, "markdown");
  const insertIdx = Math.min(1, contentParagraphs.length);
  const mdParts = [...contentParagraphs];
  mdParts.splice(insertIdx, 0, photoBlock);
  return `# ${title}\n\n${mdParts.join("\n\n")}\n\n${tagStr}`;
}
