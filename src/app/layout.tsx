import "./globals.css";
import { Nav } from "@/components/ui/nav";
import { AdProvider } from "@/components/ad-provider";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { StructuredData } from "@/components/structured-data";
import { generateMetadata as seo } from "@/lib/seo";

export const metadata = seo();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <StructuredData />
        <AdProvider>
          <AnalyticsProvider>
            <Nav />
            <main>
              {children}
            </main>
          </AnalyticsProvider>
        </AdProvider>
      </body>
    </html>
  );
}
