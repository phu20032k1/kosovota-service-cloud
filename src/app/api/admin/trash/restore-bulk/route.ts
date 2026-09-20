import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";

const MAX_BULK = 100;

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được khôi phục dữ liệu." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body.ids) ? body.ids : [];
  const ids: string[] = Array.from(new Set(raw.map((value) => typeof value === "string" ? value.trim() : "").filter((value): value is string => Boolean(value)))).slice(0, MAX_BULK);
  if (!ids.length) return NextResponse.json({ success: false, message: "Chưa chọn dữ liệu cần khôi phục." }, { status: 400 });

  let restored = 0;
  const failed: Array<{ id: string; message: string }> = [];
  const origin = new URL(request.url).origin;

  for (const id of ids) {
    const response = await fetch(origin + "/api/admin/trash/" + encodeURIComponent(id) + "/restore", {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") || "",
        authorization: request.headers.get("authorization") || "",
      },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.success) restored += 1;
    else failed.push({ id, message: payload.message || "Không khôi phục được." });
  }

  return NextResponse.json({
    success: restored > 0,
    restored,
    failed,
    message: failed.length
      ? `Đã khôi phục ${restored}/${ids.length} mục. ${failed.length} mục cần kiểm tra lại.`
      : `Đã khôi phục ${restored} mục từ Thùng rác.`,
  }, { status: restored > 0 ? 200 : 409 });
}
