import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import { isAdminEmail } from "@/lib/admin";
import { getUserById } from "@/lib/models/user";
import * as apiUsageModel from "@/lib/models/apiUsage";

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const user = await getUserById(auth.userId);
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [users, monthly] = await Promise.all([
    apiUsageModel.getUsersWithUsage(),
    apiUsageModel.getMonthlySummary(),
  ]);

  return NextResponse.json({ users, monthly });
}
