import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csv(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["DIRECTOR"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Giám đốc được xuất báo cáo này." }, { status: 403 });

  try {
    const machines = await prisma.machine.findMany({
      include: {
        customer: { select: { name: true, phone: true, address: true, satisfaction: true } },
        maintenanceSchedules: { orderBy: { dueDate: "asc" }, take: 1 },
        serviceOrders: { where: { status: "COMPLETED" }, orderBy: { updatedAt: "desc" }, take: 1, select: { orderCode: true, serviceType: true, serviceFee: true, updatedAt: true } },
      },
      orderBy: { id: "asc" },
    });

    const header = ["Seri máy", "Dòng máy", "Trạng thái", "Tỉnh", "Ngày lắp", "Khách hàng", "SĐT", "Địa chỉ", "Hài lòng", "GPS", "Lịch sắp tới", "Lệnh hoàn thành gần nhất", "Dịch vụ gần nhất", "Giá trị gần nhất", "Ngày hoàn thành"];
    const rows = machines.map((machine) => {
      const schedule = machine.maintenanceSchedules[0];
      const order = machine.serviceOrders[0];
      return [
        machine.id,
        machine.model,
        machine.status,
        machine.provinceCode || "",
        machine.installDate ? machine.installDate.toISOString().slice(0, 10) : "",
        machine.customer?.name || "",
        machine.customer?.phone || "",
        machine.customer?.address || "",
        machine.customer?.satisfaction ?? "",
        machine.lat != null && machine.lng != null ? `${machine.lat},${machine.lng}` : "",
        schedule ? `${schedule.title} - ${schedule.dueDate.toISOString().slice(0, 10)} - ${schedule.status}` : "",
        order?.orderCode || "",
        order?.serviceType || "",
        order?.serviceFee || 0,
        order?.updatedAt ? order.updatedAt.toISOString() : "",
      ];
    });
    const body = `\uFEFF${[header, ...rows].map((row) => row.map(csv).join(",")).join("\r\n")}`;
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="kosovota-director-${date}.csv"`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("director export failed", error);
    return NextResponse.json({ success: false, message: "Không xuất được dữ liệu." }, { status: 500 });
  }
}
