import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDueMaintenanceOrders } from "@/lib/maintenance-automation";

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  try {
    const cutoff = request.nextUrl.searchParams.get("through");
    const through = cutoff ? new Date(cutoff) : new Date();
    if (Number.isNaN(through.getTime())) {
      return NextResponse.json({ success: false, message: "Mốc thời gian không hợp lệ." }, { status: 400 });
    }

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
      message: `Đã tạo ${result.created} lệnh đến hạn; bỏ qua ${result.skipped} lịch chưa đủ dữ liệu hoặc đã được xử lý.`,
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
