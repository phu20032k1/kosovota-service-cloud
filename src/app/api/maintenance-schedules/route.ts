import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { expandProvinceScope } from "@/lib/province";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const machineId = request.nextUrl.searchParams.get("machineId")?.trim();
    const statusParam = request.nextUrl.searchParams.get("status")?.trim();
    const statuses = statusParam
      ? statusParam.split(",").map((value) => value.trim()).filter(Boolean)
      : [];
    const scope = auth.user.role === "CSKH" ? expandProvinceScope(auth.user.provinceScope) : [];
    const schedules = await prisma.maintenanceSchedule.findMany({
      where: {
        ...(machineId ? { machineId } : {}),
        ...(statuses.length === 1 ? { status: statuses[0] } : statuses.length > 1 ? { status: { in: statuses } } : {}),
        ...(scope.length ? { machine: { provinceCode: { in: scope } } } : {}),
      },
      include: { machine: { include: { customer: true } }, serviceOrder: true },
      orderBy: { dueDate: "asc" },
    });
    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    console.error("GET schedules failed", error);
    return NextResponse.json({ success: false, message: "Không tải được lịch bảo trì." }, { status: 500 });
  }
}
