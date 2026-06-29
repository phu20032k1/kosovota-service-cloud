import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { createOrderCode } from "@/lib/order-code";

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const cutoff = request.nextUrl.searchParams.get("through");
    const through = cutoff ? new Date(cutoff) : new Date();
    if (Number.isNaN(through.getTime())) return NextResponse.json({ success: false, message: "Mốc thời gian không hợp lệ." }, { status: 400 });

    const schedules = await prisma.maintenanceSchedule.findMany({
      where: { status: "PENDING", dueDate: { lte: through }, serviceOrder: null },
      include: { machine: { include: { customer: true } } },
      orderBy: { dueDate: "asc" },
    });
    let created = 0;
    let skipped = 0;
    for (const schedule of schedules) {
      const customer = schedule.machine.customer;
      if (!customer?.phone) { skipped += 1; continue; }
      try {
        const orderCode = await createOrderCode(schedule.machine.provinceCode || "01");
        await prisma.$transaction(async (tx) => {
          await tx.serviceOrder.create({
            data: {
              orderCode,
              machineId: schedule.machineId,
              maintenanceScheduleId: schedule.id,
              customerName: customer.name,
              customerPhone: customer.phone,
              address: customer.address,
              serviceType: schedule.title,
              dueDate: schedule.dueDate,
              status: "NEW",
            },
          });
          await tx.maintenanceSchedule.update({ where: { id: schedule.id }, data: { status: "ORDER_CREATED" } });
        });
        created += 1;
      } catch { skipped += 1; }
    }
    return NextResponse.json({ success: true, message: `Đã tạo ${created} lệnh; bỏ qua ${skipped} lịch chưa đủ dữ liệu hoặc đã được xử lý.`, created, skipped });
  } catch (error) {
    console.error("generate orders failed", error);
    return NextResponse.json({ success: false, message: "Không sinh được lệnh từ lịch bảo trì." }, { status: 500 });
  }
}
