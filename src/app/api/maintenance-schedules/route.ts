import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { cskhScopeAllows } from "@/lib/province-access";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["SUPER_ADMIN", "ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const machineId = request.nextUrl.searchParams.get("machineId")?.trim();
    const statusParam = request.nextUrl.searchParams.get("status")?.trim();
    const statuses = statusParam ? statusParam.split(",").map((value) => value.trim()).filter(Boolean) : [];
    const schedules = await prisma.maintenanceSchedule.findMany({
      where: {
        ...(machineId ? { machineId } : {}),
        ...(statuses.length === 1 ? { status: statuses[0] } : statuses.length > 1 ? { status: { in: statuses } } : {}),
      },
      include: { machine: { include: { customer: true } }, serviceOrder: true },
      orderBy: { dueDate: "asc" },
    });

    const scopedSchedules = auth.user.role === "CSKH"
      ? schedules.filter((schedule) => cskhScopeAllows(
          auth.user,
          {
            provinceValue: schedule.machine.provinceCode,
            address: schedule.machine.customer?.address,
            customerId: schedule.machine.customerId,
          },
        ))
      : schedules;

    return NextResponse.json({ success: true, data: scopedSchedules });
  } catch (error) {
    console.error("GET schedules failed", error);
    return NextResponse.json({ success: false, message: "Không tải được lịch bảo trì." }, { status: 500 });
  }
}
