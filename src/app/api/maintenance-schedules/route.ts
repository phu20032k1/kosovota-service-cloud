import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const machineId = request.nextUrl.searchParams.get("machineId")?.trim();
    const status = request.nextUrl.searchParams.get("status")?.trim();
    const scopes = auth.user.provinceScope?.split(",").map((value: string) => value.trim()).filter(Boolean) || [];
    const schedules = await prisma.maintenanceSchedule.findMany({
      where: {
        ...(machineId ? { machineId } : {}), ...(status ? { status } : {}),
        ...(auth.user.role === "CSKH" && scopes.length ? { machine: { provinceCode: { in: scopes } } } : {}),
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
