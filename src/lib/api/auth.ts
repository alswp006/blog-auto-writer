import type { NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { jsonError } from "@/lib/api/errors";

export interface AuthResult {
  userId: number;
}

export type RequireAuthReturn =
  | { ok: true; userId: number }
  | { ok: false; response: ReturnType<typeof jsonError> };

export function requireAuthUser(request: NextRequest): RequireAuthReturn {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/session_token=([^;]+)/);
  const token = match?.[1] ?? null;

  if (!token) {
    return {
      ok: false,
      response: jsonError(401, "UNAUTHORIZED", "Authentication required"),
    };
  }

  const userId = getSessionUserId(token);
  if (!userId) {
    return {
      ok: false,
      response: jsonError(401, "UNAUTHORIZED", "Invalid or expired session"),
    };
  }

  return { ok: true, userId };
}
