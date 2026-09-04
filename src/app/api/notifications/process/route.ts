import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { processNotificationQueue } from "@/lib/notifications/process";

function hasCronSecret(request: NextRequest) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return request.headers.get("x-cron-secret") === configured || bearer === configured;
}

async function authorize(request: NextRequest) {
  if (hasCronSecret(request)) return true;
  return Boolean(await hasRole(request, ["ADMIN"]));
}

async function run(request: NextRequest, limitInput?: unknown) {
  if (!(await authorize(request))) {
    return NextResponse.json(
      { success: false, message: "Chỉ Admin hoặc cron hợp lệ được xử lý hàng đợi." },
      { status: 403 },
    );
  }
  const limit = Math.min(Math.max(Number(limitInput) || 20, 1), 100);
  const summary = await processNotificationQueue(limit);
  return NextResponse.json({ success: true, message: `Đã xử lý ${summary.total} thông báo.`, data: summary });
}

export async function GET(request: NextRequest) {
  return run(request, request.nextUrl.searchParams.get("limit"));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  return run(request, body.limit);
}
