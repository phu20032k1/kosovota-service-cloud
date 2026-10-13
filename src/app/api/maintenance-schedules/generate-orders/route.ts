import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDueMaintenanceOrders } from "@/lib/maintenance-automation";
import { endOfVietnamCalendarDay } from "@/lib/maintenance-time";

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  try {
    const cutoff = request.nextUrl.searchParams.get("through");
    const requestedThrough = cutoff ? new Date(cutoff) : new Date();
    if (Number.isNaN(requestedThrough.getTime())) {
      return NextResponse.json({ success: false, message: "Mốc thời gian không hợp lệ." }, { status: 400 });
    }

    // Lịch bảo trì là lịch theo ngày. Bao trọn ngày Việt Nam để một lịch được
    // chỉnh thành "hôm nay" (ví dụ lưu lúc 12:00 +07) vẫn được sinh lệnh ngay
    // cả khi nút được bấm vào buổi sáng.
    const through = endOfVietnamCalendarDay(requestedThrough);
    const result = await generateDueMaintenanceOrders(through);
    await prisma.adminLog.create({
      data: {
        userId: auth.user.id,
        action: "GENERATE_MAINTENANCE_ORDERS",
        detail: `Quét ${result.scanned}; tạo ${result.created}; bỏ qua ${result.skipped}; lỗi ${result.failed.length}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã tạo ${result.created} lệnh kỹ thuật đến hạn; ${result.careOnly} mốc chăm sóc được giữ ở lịch nhắc; bỏ qua ${result.skipped - result.careOnly} lịch chưa đủ dữ liệu hoặc đã được xử lý.`,
      created: result.created,
      skipped: result.skipped,
      data: result,
    });
  } catch (error) {
    console.error("generate orders failed", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Không sinh được lệnh từ lịch bảo trì.",
    }, { status: 500 });
  }
}
