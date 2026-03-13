/**
 * Place enrichment module — fetches real data from Naver APIs + Google CSE
 * to supplement user-provided information in blog generation.
 *
 * Data sources:
 * 1. Naver Local Search — place category, road address
 * 2. Naver Blog Search — blog snippets (title + description only)
 * 3. Google Custom Search — find blog posts on crawl-friendly sites
 * 4. Direct blog fetch — full text from Tistory, WordPress, etc. (not Naver)
 */

export type EnrichedPlaceInfo = {
  naverCategory: string | null;
  roadAddress: string | null;
  blogExcerpts: string[];       // short snippets from Naver Blog Search
  blogFullTexts: string[];      // richer extracts from crawled blog posts
  blogKeywords: string[];       // common keywords across all sources
};

// ── Naver API ──

const NAVER_API_HEADERS = () => {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return null;
  return {
    "X-Naver-Client-Id": id,
    "X-Naver-Client-Secret": secret,
  };
};

/** Strip HTML tags */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

/** Fetch Naver Local Search for place details */
async function fetchPlaceDetails(
  placeName: string,
  address: string | null,
  headers: Record<string, string>,
): Promise<{ naverCategory: string | null; roadAddress: string | null }> {
  try {
    const query = address
      ? `${placeName} ${address.split(" ").slice(0, 2).join(" ")}`
      : placeName;
    const res = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=1&sort=comment`,
      { headers, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return { naverCategory: null, roadAddress: null };
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return { naverCategory: null, roadAddress: null };
    return {
      naverCategory: stripHtml(item.category ?? ""),
      roadAddress: stripHtml(item.roadAddress ?? ""),
    };
  } catch {
    return { naverCategory: null, roadAddress: null };
  }
}

/** Fetch Naver Blog Search for snippets */
async function fetchNaverBlogSnippets(
  placeName: string,
  address: string | null,
  headers: Record<string, string>,
): Promise<{ excerpts: string[]; allText: string }> {
  try {
    const area = address?.split(" ").slice(0, 2).join(" ") ?? "";
    const query = area ? `${placeName} ${area} 후기` : `${placeName} 후기`;
    const res = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=5&sort=sim`,
      { headers, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return { excerpts: [], allText: "" };
    const data = await res.json();
    const items: { title: string; description: string }[] = data.items ?? [];

    const excerpts: string[] = [];
    const texts: string[] = [];

    for (const item of items.slice(0, 5)) {
      const title = stripHtml(item.title);
      const desc = stripHtml(item.description);
      if (desc.length > 20) {
        excerpts.push(`[${title}] ${desc}`);
        texts.push(`${title} ${desc}`);
      }
    }

    return { excerpts, allText: texts.join(" ") };
  } catch {
    return { excerpts: [], allText: "" };
  }
}

// ── Google Custom Search API ──

/** Domains we're allowed to crawl full content from */
const CRAWLABLE_DOMAINS = [
  "tistory.com",
  "wordpress.com",
  "wp.com",
  "brunch.co.kr",
  "velog.io",
  "medium.com",
  "blogspot.com",
  "blogger.com",
  "notion.site",
];

function isCrawlableDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return CRAWLABLE_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

type GoogleSearchResult = { title: string; link: string; snippet: string };

/** Search Google Custom Search for blog posts about this place */
async function fetchGoogleBlogUrls(
  placeName: string,
  address: string | null,
): Promise<GoogleSearchResult[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!apiKey || !cx) return [];

  try {
    const area = address?.split(" ").slice(0, 2).join(" ") ?? "";
    const query = area ? `${placeName} ${area} 후기 리뷰` : `${placeName} 후기 리뷰`;
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=5`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map((item: { title?: string; link?: string; snippet?: string }) => ({
      title: item.title ?? "",
      link: item.link ?? "",
      snippet: item.snippet ?? "",
    }));
  } catch {
    return [];
  }
}

// ── Blog content extraction ──

/**
 * Fetch a blog page and extract main text content.
 * Only fetches from CRAWLABLE_DOMAINS (Tistory, WordPress, etc.)
 * Returns truncated text (max 1500 chars) focused on the article body.
 */
async function fetchBlogContent(url: string): Promise<string | null> {
  if (!isCrawlableDomain(url)) return null;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BlogAutoWriter/1.0; +blog-reference)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    return extractArticleText(html);
  } catch {
    return null;
  }
}

/**
 * Extract main article text from HTML.
 * Targets common blog article containers, strips nav/sidebar/footer.
 */
function extractArticleText(html: string): string | null {
  // Remove script, style, nav, header, footer, aside tags and their content
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "");

  // Try to find article or main content container
  const articleMatch = cleaned.match(/<article[\s\S]*?<\/article>/i)
    ?? cleaned.match(/<div[^>]*class="[^"]*(?:entry-content|post-content|article-content|tt_article_useless_p_margin|contents_style)[^"]*"[\s\S]*?<\/div>/i)
    ?? cleaned.match(/<main[\s\S]*?<\/main>/i);

  const source = articleMatch ? articleMatch[0] : cleaned;

  // Strip all remaining HTML tags
  let text = source
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Must have meaningful content (not just navigation text)
  if (text.length < 200) return null;

  // Truncate to ~1500 chars at a paragraph boundary
  if (text.length > 1500) {
    const cutPoint = text.lastIndexOf("\n", 1500);
    text = text.slice(0, cutPoint > 800 ? cutPoint : 1500) + "...";
  }

  return text;
}

/**
 * Fetch and extract content from multiple blog URLs in parallel.
 * Limits to 3 concurrent fetches to be respectful.
 */
async function fetchMultipleBlogContents(
  results: GoogleSearchResult[],
): Promise<{ title: string; content: string }[]> {
  const crawlable = results.filter((r) => isCrawlableDomain(r.link)).slice(0, 3);
  if (crawlable.length === 0) return [];

  const fetched = await Promise.all(
    crawlable.map(async (r) => {
      const content = await fetchBlogContent(r.link);
      return content ? { title: r.title, content } : null;
    }),
  );

  return fetched.filter((f): f is { title: string; content: string } => f !== null);
}

// ── Keyword extraction ──

function extractKeywords(text: string, placeName: string): string[] {
  const cleaned = text.replace(new RegExp(placeName, "g"), "");
  const stopWords = new Set([
    "있는", "있어", "있다", "하는", "하고", "해서", "그리고", "이런", "저런",
    "정말", "진짜", "너무", "아주", "매우", "좋은", "좋아", "같은", "같아",
    "하나", "것이", "때문", "통해", "위해", "대한", "관련", "대해",
    "그래서", "이렇게", "그런데", "근데", "여기", "거기", "이번", "이날",
    "the", "and", "was", "for", "with", "this", "that", "from",
  ]);
  const freq = new Map<string, number>();
  for (const word of cleaned.split(/\s+/)) {
    const w = word.replace(/[^가-힣a-zA-Z]/g, "");
    if (w.length < 2 || stopWords.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

// ── Main enrichment function ──

/**
 * Enrich a place with external data from Naver + Google APIs.
 * Returns empty/null values gracefully if APIs are unavailable.
 * All fetches are non-blocking — failures don't break generation.
 */
export async function enrichPlace(
  placeName: string,
  address: string | null,
): Promise<EnrichedPlaceInfo> {
  const naverHeaders = NAVER_API_HEADERS();

  // Phase 1: Parallel — Naver (place + blog snippets) + Google search
  const [naverDetails, naverBlogs, googleResults] = await Promise.all([
    naverHeaders
      ? fetchPlaceDetails(placeName, address, naverHeaders)
      : Promise.resolve({ naverCategory: null, roadAddress: null }),
    naverHeaders
      ? fetchNaverBlogSnippets(placeName, address, naverHeaders)
      : Promise.resolve({ excerpts: [] as string[], allText: "" }),
    fetchGoogleBlogUrls(placeName, address),
  ]);

  // Phase 2: Fetch full blog content from crawlable Google results
  const blogContents = await fetchMultipleBlogContents(googleResults);

  // Build full text extracts (title + truncated body)
  const blogFullTexts = blogContents.map(
    (b) => `[${b.title}]\n${b.content}`,
  );

  // Also use Google snippets from non-crawlable results as extra excerpts
  const googleSnippets = googleResults
    .filter((r) => !isCrawlableDomain(r.link) && r.snippet.length > 30)
    .slice(0, 3)
    .map((r) => `[${r.title}] ${r.snippet}`);

  // Combine all excerpts (Naver snippets + Google snippets)
  const allExcerpts = [...naverBlogs.excerpts, ...googleSnippets];

  // Extract keywords from all text sources
  const allText = [
    naverBlogs.allText,
    ...googleResults.map((r) => `${r.title} ${r.snippet}`),
    ...blogContents.map((b) => b.content),
  ].join(" ");
  const keywords = extractKeywords(allText, placeName);

  return {
    naverCategory: naverDetails.naverCategory || null,
    roadAddress: naverDetails.roadAddress || null,
    blogExcerpts: allExcerpts,
    blogFullTexts,
    blogKeywords: keywords,
  };
}
