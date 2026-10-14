import { archiveToTrash } from "@/lib/trash";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { generateDueMaintenanceOrders } from "@/lib/maintenance-automation";
import { endOfVietnamCalendarDay } from "@/lib/maintenance-time";

type Params = { params: Promise<{ id: string }> };

function parseCalendarDueDate(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      // Lịch bảo trì là dữ liệu theo ngày, không phải một thời điểm theo timezone.
      // Lưu giữa ngày UTC để ngày người dùng chọn không bị nhảy sang hôm trước/sau
      // khi trình duyệt, server và dữ liệu cũ đang ở timezone khác nhau.
      const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      if (
        date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day
      ) {
        return date;
      }
      return null;
    }
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const allowed = ["PENDING", "ORDER_CREATED", "COMPLETED", "DISABLED", "SELF_SERVICE"];
  const current = await prisma.maintenanceSchedule.findUnique({
    where: { id },
    include: { machine: { select: { provinceCode: true } }, serviceOrder: { select: { id: true } } },
  });
  if (!current) return NextResponse.json({ success: false, message: "Không tìm thấy lịch bảo trì." }, { status: 404 });
  const scopes = auth.user.provinceScope?.split(",").map((value: string) => value.trim()).filter(Boolean) || [];
  if (auth.user.role === "CSKH" && scopes.length && (!current.machine.provinceCode || !scopes.includes(current.machine.provinceCode))) {
    return NextResponse.json({ success: false, message: "Lịch nằm ngoài phạm vi được phân công." }, { status: 403 });
  }

  const data: { status?: string; dueDate?: Date; title?: string } = {};
  if ("status" in body) {
    if (!allowed.includes(body.status)) return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
    data.status = body.status;
  }
  if ("dueDate" in body) {
    const dueDate = parseCalendarDueDate(body.dueDate);
    if (!dueDate) return NextResponse.json({ success: false, message: "Ngày đến hạn không hợp lệ." }, { status: 400 });
    if (current.serviceOrder) return NextResponse.json({ success: false, message: "Lịch đã sinh lệnh dịch vụ; hãy đổi hạn trên lệnh để tránh lệch dữ liệu." }, { status: 409 });
    data.dueDate = dueDate;
  }
  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ success: false, message: "Nội dung lịch không được để trống." }, { status: 400 });
    data.title = title;
  }
  if (!Object.keys(data).length) return NextResponse.json({ success: false, message: "Không có thay đổi hợp lệ." }, { status: 400 });

  const schedule = await prisma.maintenanceSchedule.update({ where: { id }, data });

  // Khi Admin/CSKH đưa một mốc kỹ thuật về hôm nay hoặc quá hạn, hệ thống tự
  // sinh lệnh và tự tìm đại lý ngay. Nút "Tạo lệnh đến hạn" chỉ còn là phương án
  // dự phòng, không còn là bước bắt buộc trong quy trình vận hành.
  let automaticOrderGeneration: Awaited<ReturnType<typeof generateDueMaintenanceOrders>> | null = null;
  let automaticOrderGenerationError: string | null = null;
  if (data.dueDate && schedule.status === "PENDING") {
    const through = endOfVietnamCalendarDay(new Date());
    if (schedule.dueDate <= through) {
      try {
        automaticOrderGeneration = await generateDueMaintenanceOrders(through, 1_000);
      } catch (error) {
        automaticOrderGenerationError = error instanceof Error ? error.message : "Không tự sinh được lệnh đến hạn.";
        console.error("automatic maintenance order generation failed", error);
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: schedule,
    automation: {
      orderGeneration: automaticOrderGeneration,
      error: automaticOrderGenerationError,
    },
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xóa lịch." }, { status: 403 });
  const { id } = await params;
  const schedule = await prisma.maintenanceSchedule.findUnique({ where: { id } });
  if (!schedule) return NextResponse.json({ success: false, message: "Không tìm thấy lịch bảo trì." }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await archiveToTrash(tx, {
      entityType: "MAINTENANCE_SCHEDULE",
      entityId: schedule.id,
      label: schedule.title + " · " + schedule.machineId,
      snapshot: { record: schedule },
      deletedById: auth.user.id,
      deletedByName: auth.user.name,
      source: "/api/maintenance-schedules/[id]",
    });
    await tx.maintenanceSchedule.delete({ where: { id } });
  });
  return NextResponse.json({ success: true, message: "Đã chuyển lịch bảo trì vào Thùng rác." });
}
