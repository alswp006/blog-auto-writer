/**
 * EXIF-based photo grouping for bulk post creation.
 * Groups photos by visit: photos taken within GAP_MINUTES of each other
 * are considered the same place visit.
 *
 * Falls back gracefully when EXIF data is unavailable (KakaoTalk, social media, etc.)
 */

const GAP_MINUTES = 90;

export interface PhotoGroup {
  photos: File[];
  /** Earliest timestamp in the group — null if no EXIF */
  startTime: Date | null;
  hasExif: boolean;
}

interface FileWithTime {
  file: File;
  timestamp: Date | null;
}

async function readTimestamp(file: File): Promise<Date | null> {
  try {
    // Dynamically import exifr to avoid SSR issues
    const exifr = (await import("exifr")).default;
    const data = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"] });
    if (!data) return null;
    const raw = data.DateTimeOriginal ?? data.CreateDate;
    if (raw instanceof Date) return raw;
    if (typeof raw === "string") {
      // EXIF format: "2024:01:15 12:30:00"
      const normalized = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
      const d = new Date(normalized);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Groups an array of files into place visits based on EXIF timestamps.
 *
 * - If ALL files have no EXIF → returns one group with all files (hasExif: false)
 * - If SOME files have no EXIF → they're appended to the nearest group by file order
 * - Groups are sorted chronologically
 */
export async function groupPhotosByTime(files: File[]): Promise<PhotoGroup[]> {
  // Read timestamps in parallel
  const withTimes: FileWithTime[] = await Promise.all(
    files.map(async (file) => ({
      file,
      timestamp: await readTimestamp(file),
    }))
  );

  const withExif = withTimes.filter((f) => f.timestamp !== null);
  const noExif = withTimes.filter((f) => f.timestamp === null);

  // No EXIF at all → single group
  if (withExif.length === 0) {
    return [{ photos: files, startTime: null, hasExif: false }];
  }

  // Sort files that have EXIF by timestamp
  withExif.sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());

  // Cluster by GAP_MINUTES
  const groups: { files: FileWithTime[]; start: Date }[] = [];
  for (const item of withExif) {
    const last = groups[groups.length - 1];
    const gapMs = GAP_MINUTES * 60 * 1000;
    if (!last || item.timestamp!.getTime() - last.files[last.files.length - 1].timestamp!.getTime() > gapMs) {
      groups.push({ files: [item], start: item.timestamp! });
    } else {
      last.files.push(item);
    }
  }

  // Distribute no-EXIF files: append to the last group (they'll show up at the end)
  if (noExif.length > 0) {
    groups[groups.length - 1].files.push(...noExif);
  }

  return groups.map((g) => ({
    photos: g.files.map((f) => f.file),
    startTime: g.start,
    hasExif: true,
  }));
}

/** Quick check: does at least one file in the list have EXIF timestamp? */
export async function hasAnyExif(files: File[]): Promise<boolean> {
  for (const file of files) {
    const ts = await readTimestamp(file);
    if (ts !== null) return true;
  }
  return false;
}
