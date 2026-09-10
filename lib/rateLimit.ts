import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function getClientIp(req: NextRequest) {
  const forwarded =
    req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-forwarded-for");

  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit(
  req: NextRequest,
  scope: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const ipHash = createHash("sha256").update(getClientIp(req)).digest("hex");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bucket_key: `${scope}:${ipHash}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Availability wins if the limiter is temporarily unavailable. The error is
    // logged server-side without exposing the visitor's IP or hash.
    console.error("Rate limit check failed", { scope, code: error.code });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: result?.allowed !== false,
    retryAfterSeconds: Math.max(1, Number(result?.retry_after_seconds) || windowSeconds),
  };
}
