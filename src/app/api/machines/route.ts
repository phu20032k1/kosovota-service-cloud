import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const scopes = auth.user.provinceScope?.split(",").map((v: string) => v.trim()).filter(Boolean) || [];
    const machines = await prisma.machine.findMany({
      where: auth.user.role === "CSKH" && scopes.length ? { provinceCode: { in: scopes } } : undefined,
      include: {
        customer: true,
        activations: { orderBy: { step: "asc" } },
        serviceOrders: true,
        serviceReports: true,
        maintenanceSchedules: { orderBy: { dueDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: machines });
  } catch (error) {
    console.error("GET /api/machines failed", error);
    return NextResponse.json({ success: false, message: "Không tải được danh sách máy." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được tạo máy." }, { status: 403 });
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim().toUpperCase() : "";
    const model = typeof body.model === "string" ? body.model.trim().toUpperCase() : "";
    if (!id || !model) return NextResponse.json({ success: false, message: "ID máy và model là bắt buộc." }, { status: 400 });
    const manufactureDate = body.manufactureDate ? new Date(body.manufactureDate) : null;
    if (manufactureDate && Number.isNaN(manufactureDate.getTime())) return NextResponse.json({ success: false, message: "Ngày sản xuất không hợp lệ." }, { status: 400 });
    const machine = await prisma.machine.create({
      data: {
        id,
        model,
        name: typeof body.name === "string" ? body.name.trim() || null : null,
        capacity: typeof body.capacity === "string" ? body.capacity.trim() || null : null,
        specification: typeof body.specification === "string" ? body.specification.trim() || null : null,
        warrantyMonths: Number.isInteger(body.warrantyMonths) ? body.warrantyMonths : null,
        serial: typeof body.serial === "string" ? body.serial.trim() || null : null,
        provinceCode: typeof body.provinceCode === "string" ? body.provinceCode.trim() || null : null,
        status: typeof body.status === "string" ? body.status : "NEW",
        manufactureDate,
      },
    });
    await prisma.adminLog.create({ data: { userId: auth.user.id, action: "CREATE_MACHINE", target: id } });
    return NextResponse.json({ success: true, data: machine }, { status: 201 });
  } catch (error) {
    console.error("POST /api/machines failed", error);
    return NextResponse.json({ success: false, message: "Không thể tạo máy; ID hoặc seri có thể đã tồn tại." }, { status: 500 });
  }
}
