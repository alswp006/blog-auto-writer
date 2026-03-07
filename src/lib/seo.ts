import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Blog Auto Writer";

interface SeoOptions {
  title?: string;
  description?: string;
  path?: string;
  ogImage?: string;
}

export function generateMetadata(options: SeoOptions = {}): Metadata {
  const {
    title,
    description = `${siteName} — Build something amazing`,
    path = "",
    ogImage,
  } = options;

  const url = `${siteUrl}${path}`;
  const ogImageUrl =
    ogImage ||
    `${siteUrl}/api/og?title=${encodeURIComponent(title || siteName)}&description=${encodeURIComponent(description)}`;

  return {
    title: title ? `${title} | ${siteName}` : siteName,
    description,
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: title || siteName,
      description,
      url,
      siteName,
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title || siteName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: title || siteName,
      description,
      images: [ogImageUrl],
    },
  };
}

export { siteUrl, siteName };
