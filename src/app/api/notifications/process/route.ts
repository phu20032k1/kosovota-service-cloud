import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { processNotificationQueue } from "@/lib/notifications/process";

function hasCronSecret(request: NextRequest) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return request.headers.get("x-cron-secret") === configured || bearer === configured;
}

export async function POST(request: NextRequest) {
  const cronAuthorized = hasCronSecret(request);
  const auth = cronAuthorized ? true : Boolean(await hasRole(request, ["ADMIN"]));
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin hoặc cron hợp lệ được xử lý hàng đợi." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const summary = await processNotificationQueue(Math.min(Math.max(Number(body.limit) || 20, 1), 100));
  return NextResponse.json({ success: true, message: `Đã xử lý ${summary.total} thông báo.`, data: summary });
}
