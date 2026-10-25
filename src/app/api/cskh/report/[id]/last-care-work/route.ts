import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { SERVICE_WORK_OPTIONS } from "@/lib/cskh-report";
import { databaseErrorMessage } from "@/lib/database-errors";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["SUPER_ADMIN", "ADMIN", "CSKH"]);
  if (!auth) {
    return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const serviceType = typeof body.serviceType === "string" ? body.serviceType.trim() : "";

    if (!SERVICE_WORK_OPTIONS.includes(serviceType as (typeof SERVICE_WORK_OPTIONS)[number])) {
      return NextResponse.json({ success: false, message: "Công việc chăm sóc không hợp lệ." }, { status: 400 });
    }

    const current = await prisma.serviceOrder.findUnique({
      where: { id },
      select: { id: true, machineId: true, dueDate: true, createdAt: true },
    });

    if (!current) {
      return NextResponse.json({ success: false, message: "Không tìm thấy lệnh chăm sóc hiện tại." }, { status: 404 });
    }

    const previous = await prisma.serviceOrder.findFirst({
      where: {
        machineId: current.machineId,
        id: { not: current.id },
        status: { not: "CANCELLED" },
        ...(current.dueDate
          ? { OR: [{ dueDate: { lt: current.dueDate } }, { dueDate: null, createdAt: { lt: current.createdAt } }] }
          : { createdAt: { lt: current.createdAt } }),
      },
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, serviceType: true },
    });

    if (!previous) {
      return NextResponse.json({ success: false, message: "Máy này chưa có công việc chăm sóc trước đó để cập nhật." }, { status: 404 });
    }

    const updated = await prisma.serviceOrder.update({
      where: { id: previous.id },
      data: { serviceType },
      select: { id: true, serviceType: true, updatedAt: true },
    });

    await prisma.adminLog.create({
      data: {
        userId: auth.user.id,
        action: "CSKH_PREVIOUS_CARE_WORK_UPDATED",
        target: current.machineId,
        detail: JSON.stringify({ currentOrderId: current.id, previousOrderId: previous.id, from: previous.serviceType, to: serviceType }),
      },
    });

    return NextResponse.json({ success: true, data: updated, message: "Đã cập nhật công việc chăm sóc gần nhất." });
  } catch (error) {
    console.error("POST /api/cskh/report/[id]/last-care-work failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không cập nhật được công việc chăm sóc gần nhất.") }, { status: 500 });
  }
}
