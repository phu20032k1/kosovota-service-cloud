import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncMissingMaintenanceSchedules } from "@/lib/maintenance-automation";

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Chỉ Admin/CSKH được đồng bộ lịch còn thiếu." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const result = await syncMissingMaintenanceSchedules(Number(body.limit) || 500);

  await prisma.adminLog.create({
    data: {
      userId: auth.user.id,
      action: "SYNC_MISSING_MAINTENANCE_SCHEDULES",
      detail: `Máy đồng bộ ${result.synced}; lịch tạo ${result.createdSchedules}; lỗi ${result.failed.length}; còn lại ${result.remaining}`,
    },
  });

  return NextResponse.json({
    success: true,
    message: `Đã sinh ${result.createdSchedules} lịch cho ${result.synced} máy. Còn ${result.remaining} máy cần kiểm tra.`,
    data: result,
  });
}
