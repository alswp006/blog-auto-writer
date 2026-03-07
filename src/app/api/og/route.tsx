import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "App";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") || siteName;
  const description = searchParams.get("description") || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)",
          padding: "60px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(22, 22, 31, 0.8)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "24px",
            padding: "60px 80px",
            maxWidth: "1000px",
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#e8e8f0",
              textAlign: "center",
              lineHeight: 1.2,
              marginBottom: description ? "20px" : "0",
            }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{
                fontSize: 24,
                color: "#a8a8b8",
                textAlign: "center",
                lineHeight: 1.4,
                maxWidth: "800px",
              }}
            >
              {description}
            </div>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: 20,
            color: "#666680",
          }}
        >
          {siteName}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
