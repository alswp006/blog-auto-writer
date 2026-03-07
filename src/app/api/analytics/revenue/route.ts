import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";

// Google AdSense Management API v2
// Requires: GOOGLE_ADSENSE_CLIENT_ID, GOOGLE_ADSENSE_CLIENT_SECRET, GOOGLE_ADSENSE_REFRESH_TOKEN
// When not configured, returns { configured: false }

type DailyRevenue = {
  date: string;
  earnings: number;
  clicks: number;
  impressions: number;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const clientId = process.env.GOOGLE_ADSENSE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADSENSE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADSENSE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse.json({ configured: false, daily: [], monthTotal: 0 });
  }

  try {
    // 1. Exchange refresh token for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ configured: true, error: "Token refresh failed", daily: [], monthTotal: 0 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Get account info
    const accountsRes = await fetch(
      "https://adsense.googleapis.com/v2/accounts",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!accountsRes.ok) {
      return NextResponse.json({ configured: true, error: "Failed to fetch accounts", daily: [], monthTotal: 0 });
    }

    const accountsData = await accountsRes.json();
    const accountName = accountsData.accounts?.[0]?.name;
    if (!accountName) {
      return NextResponse.json({ configured: true, error: "No AdSense account found", daily: [], monthTotal: 0 });
    }

    // 3. Get this month's daily report
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = now;

    const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const reportRes = await fetch(
      `https://adsense.googleapis.com/v2/${accountName}/reports:generate?` +
      new URLSearchParams({
        "dateRange": "CUSTOM",
        "startDate.year": String(startDate.getFullYear()),
        "startDate.month": String(startDate.getMonth() + 1),
        "startDate.day": String(startDate.getDate()),
        "endDate.year": String(endDate.getFullYear()),
        "endDate.month": String(endDate.getMonth() + 1),
        "endDate.day": String(endDate.getDate()),
        "dimensions": "DATE",
        "metrics": "ESTIMATED_EARNINGS,CLICKS,IMPRESSIONS",
      }),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!reportRes.ok) {
      return NextResponse.json({ configured: true, error: "Failed to fetch report", daily: [], monthTotal: 0 });
    }

    const reportData = await reportRes.json();
    const rows = reportData.rows ?? [];

    const daily: DailyRevenue[] = rows.map((row: { cells: { value: string }[] }) => ({
      date: row.cells[0]?.value ?? formatDate(now),
      earnings: parseFloat(row.cells[1]?.value ?? "0") / 1000000, // micros to currency
      clicks: parseInt(row.cells[2]?.value ?? "0", 10),
      impressions: parseInt(row.cells[3]?.value ?? "0", 10),
    }));

    const monthTotal = daily.reduce((sum, d) => sum + d.earnings, 0);

    return NextResponse.json({ configured: true, daily, monthTotal });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      error: err instanceof Error ? err.message : "Unknown error",
      daily: [],
      monthTotal: 0,
    });
  }
}
