import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export async function GET() {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json(
        { success: false, message: "Redis chưa được cấu hình." },
        { status: 503 },
      );
    }

    const count = await redis.incr("kosovota:test");
    await redis.expire("kosovota:test", 300);

    return NextResponse.json({ success: true, redis: "OK", count });
  } catch (error) {
    console.error("Redis test failed", error);
    return NextResponse.json(
      { success: false, message: "Kết nối Redis thất bại." },
      { status: 500 },
    );
  }
}
