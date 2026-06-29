import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const storageProvider = (process.env.STORAGE_PROVIDER || "local").toLowerCase();
    const r2Ready = storageProvider !== "r2" || Boolean(
      process.env.R2_ACCOUNT_ID
      && process.env.R2_ACCESS_KEY_ID
      && process.env.R2_SECRET_ACCESS_KEY
      && process.env.R2_BUCKET
      && process.env.R2_PUBLIC_BASE_URL,
    );
    return NextResponse.json({
      success: true,
      status: "ok",
      database: "connected",
      storage: { provider: storageProvider, configured: r2Ready },
      responseMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error("health check failed", error);
    return NextResponse.json({
      success: false,
      status: "degraded",
      database: "disconnected",
      storage: { provider: (process.env.STORAGE_PROVIDER || "local").toLowerCase() },
      responseMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    }, { status: 503 });
  }
}
