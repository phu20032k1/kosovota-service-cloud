import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { getRedis, redisConfigured } from "@/lib/redis";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const auth = await hasRole(request, ["ADMIN"]);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin được kiểm tra Redis trên production." },
        { status: 403 },
      );
    }
  }

  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json(
        { success: false, redis: "DISABLED", configured: redisConfigured(), message: "Redis chưa được cấu hình." },
        { status: 503 },
      );
    }

    const startedAt = Date.now();
    const count = await redis.incr("kosovota:test");
    await redis.expire("kosovota:test", 300);

    return NextResponse.json({
      success: true,
      redis: "OK",
      configured: true,
      latencyMs: Date.now() - startedAt,
      count,
    });
  } catch (error) {
    console.error("Redis test failed", error);
    return NextResponse.json(
      { success: false, redis: "ERROR", configured: redisConfigured(), message: "Kết nối Redis thất bại." },
      { status: 500 },
    );
  }
}
