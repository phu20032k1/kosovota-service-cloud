import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { createOrderCode } from "@/lib/order-code";
import { queueServiceOrderCreatedNotifications } from "@/lib/notifications/events";
import { databaseErrorMessage } from "@/lib/database-errors";

const ORDER_INCLUDE = {
  machine: { include: { customer: true } },
  dealer: true,
  reports: true,
  maintenanceSchedule: true,
  technician: { select: { id: true, name: true, phone: true, active: true } },
  sourceTicket: { select: { id: true, ticketCode: true, subject: true, status: true, priority: true } },
} as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await hasRole(request, ["ADMIN", "CSKH", "DEALER", "CTV", "KTV"]);
    if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

    const status = request.nextUrl.searchParams.get("status") || undefined;
    const machineId = request.nextUrl.searchParams.get("machineId") || undefined;
    const provinceScope = auth.user.provinceScope?.split(",").map((v: string) => v.trim()).filter(Boolean) || [];

    const orders = await prisma.serviceOrder.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(machineId ? { machineId } : {}),
        ...(["DEALER", "CTV"].includes(auth.user.role) ? { dealer: { dealerCode: auth.user.dealerCode || "__NONE__" } } : {}),
        ...(auth.user.role === "KTV" ? { technicianId: auth.user.id } : {}),
        ...(auth.user.role === "CSKH" && provinceScope.length
          ? { machine: { provinceCode: { in: provinceScope } } }
          : {}),
      },
      include: ORDER_INCLUDE,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error("GET /api/service-orders failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không tải được danh sách lệnh.") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  try {
    const body = await request.json();
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    const serviceType = typeof body.serviceType === "string" ? body.serviceType.trim() : "";
    if (!machineId || !serviceType) {
      return NextResponse.json({ success: false, message: "Thiếu ID máy hoặc dịch vụ." }, { status: 400 });
    }

    const machine = await prisma.machine.findUnique({ where: { id: machineId }, include: { customer: true } });
    if (!machine) return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });

    const customerName = (typeof body.customerName === "string" && body.customerName.trim()) || machine.customer?.name;
    const customerPhone = normalizePhone(body.customerPhone || machine.customer?.phone);
    if (!customerName || !customerPhone) {
      return NextResponse.json({ success: false, message: "Máy chưa có đủ thông tin khách hàng." }, { status: 400 });
    }

    const orderCode = await createOrderCode(machine.provinceCode || "01");
    const order = await prisma.serviceOrder.create({
      data: {
        orderCode,
        machineId,
        dealerId: typeof body.dealerId === "string" ? body.dealerId : null,
        maintenanceScheduleId: typeof body.maintenanceScheduleId === "string" ? body.maintenanceScheduleId : null,
        customerName,
        customerPhone,
        address: (typeof body.address === "string" && body.address.trim()) || machine.customer?.address || null,
        serviceType,
        status: typeof body.status === "string" ? body.status : "NEW",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        serviceFee: Number.isFinite(Number(body.serviceFee)) ? Number(body.serviceFee) : null,
      },
      include: ORDER_INCLUDE,
    });

    await prisma.adminLog.create({ data: { userId: auth.user.id, action: "CREATE_SERVICE_ORDER", target: order.orderCode } });
    if (order.machine.customer) {
      await queueServiceOrderCreatedNotifications({
        orderCode: order.orderCode,
        machineId: order.machineId,
        serviceType: order.serviceType,
        dueDate: order.dueDate,
        customer: order.machine.customer,
      });
    }
    return NextResponse.json({ success: true, message: "Đã tạo lệnh dịch vụ.", data: order }, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-orders failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không tạo được lệnh dịch vụ.") }, { status: 500 });
  }
}
