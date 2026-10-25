import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { checkDistributedRateLimit } from "@/lib/rate-limit";

/**
 * Endpoint tương thích với client cũ.
 * Luồng kích hoạt chuẩn phải đi qua /api/activations bước 1 + bước 2 để bảo đảm
 * customer, GPS, installDate, Activation và MaintenanceSchedule được ghi atomically.
 * Endpoint cũ trước đây chỉ set status=ACTIVE nên tạo ra máy "kích hoạt nửa vời".
 */
export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["SUPER_ADMIN", "ADMIN", "DEALER", "CTV", "KTV"]);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Cần đăng nhập tài khoản được phép kích hoạt máy." },
      { status: 401 },
    );
  }

  const rate = await checkDistributedRateLimit(request, {
    namespace: "machine-activate",
    limit: 30,
    windowMs: 5 * 60 * 1000,
    identifier: `${auth.user.id}:${auth.user.phone}`,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, message: "Thao tác kích hoạt quá nhiều lần. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    if (!machineId) {
      return NextResponse.json({ success: false, message: "Thiếu ID máy." }, { status: 400 });
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        customer: true,
        activations: { where: { step: 2 }, take: 1 },
        maintenanceSchedules: { orderBy: { dueDate: "asc" } },
      },
    });
    if (!machine) {
      return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });
    }

    const completed = Boolean(machine.installDate && machine.activations.length > 0);
    if (!completed) {
      return NextResponse.json({
        success: false,
        message: "Luồng kích hoạt nhanh cũ đã được khóa vì có thể làm thiếu ngày lắp/lịch thay lõi. Hãy hoàn tất kích hoạt bằng biểu mẫu chuẩn (bước 1 + bước 2).",
        code: "LEGACY_ACTIVATION_DISABLED",
      }, { status: 409 });
    }

    // Idempotent với máy đã hoàn tất: không ghi đè customer/status/installDate.
    return NextResponse.json({
      success: true,
      message: "Máy đã hoàn tất kích hoạt trước đó.",
      machine,
      duplicate: true,
    });
  } catch (error) {
    console.error("POST /api/machines/activate failed", error);
    return NextResponse.json({ success: false, message: "Không thể kiểm tra trạng thái kích hoạt máy lúc này." }, { status: 500 });
  }
}
