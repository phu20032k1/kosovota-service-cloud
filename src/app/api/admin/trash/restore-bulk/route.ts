import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { restoreTrashItem } from "@/app/api/admin/trash/[id]/restore/route";

const MAX_BULK = 100;

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được khôi phục dữ liệu." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const raw = Array.isArray(body.ids) ? body.ids : [];
  const ids = Array.from(new Set(raw.map((value: unknown) => String(value || "").trim()).filter(Boolean))).slice(0, MAX_BULK);
  if (!ids.length) return NextResponse.json({ success: false, message: "Chưa chọn dữ liệu cần khôi phục." }, { status: 400 });

  let restored = 0;
  const failed: Array<{ id: string; message: string }> = [];
  for (const id of ids) {
    const response = await restoreTrashItem(request, id);
    const payload = await response.clone().json().catch(() => ({}));
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
