import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Tistory OAuth callback — exchanges code for access_token
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    // Redirect back to settings with error
    const url = new URL("/dashboard/settings", request.url);
    url.searchParams.set("tistory_error", error ?? "no_code");
    return NextResponse.redirect(url);
  }

  const clientId = process.env.TISTORY_APP_ID;
  const clientSecret = process.env.TISTORY_SECRET_KEY;
  const redirectUri = `${request.nextUrl.origin}/api/tistory/callback`;

  if (!clientId || !clientSecret) {
    const url = new URL("/dashboard/settings", request.url);
    url.searchParams.set("tistory_error", "missing_env");
    return NextResponse.redirect(url);
  }

  try {
    // Exchange code for access token
    const tokenUrl = new URL("https://www.tistory.com/oauth/access_token");
    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("grant_type", "authorization_code");

    const tokenRes = await fetch(tokenUrl.toString());
    if (!tokenRes.ok) {
      const url = new URL("/dashboard/settings", request.url);
      url.searchParams.set("tistory_error", "token_exchange_failed");
      return NextResponse.redirect(url);
    }

    const tokenText = await tokenRes.text();
    // Tistory returns access_token=xxxx or JSON
    let accessToken: string | null = null;
    try {
      const json = JSON.parse(tokenText);
      accessToken = json.access_token;
    } catch {
      // Parse as query string format: access_token=xxxxx
      const match = tokenText.match(/access_token=([^&]+)/);
      accessToken = match?.[1] ?? null;
    }

    if (!accessToken) {
      const url = new URL("/dashboard/settings", request.url);
      url.searchParams.set("tistory_error", "no_token");
      return NextResponse.redirect(url);
    }

    // Redirect to settings page with the token in a short-lived param
    // The settings page will then save it via the connections API
    const url = new URL("/dashboard/settings", request.url);
    url.searchParams.set("tistory_token", accessToken);
    return NextResponse.redirect(url);
  } catch {
    const url = new URL("/dashboard/settings", request.url);
    url.searchParams.set("tistory_error", "unknown");
    return NextResponse.redirect(url);
  }
}
