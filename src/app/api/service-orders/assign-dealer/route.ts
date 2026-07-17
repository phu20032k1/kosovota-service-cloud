import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { createOrderCode } from "@/lib/order-code";
import { normalizePhone } from "@/lib/phone";
import { queueDealerServiceOrderEmail } from "@/lib/notifications/events";

function canAccessProvince(role: string, scopeValue: string | null, provinceCode?: string | null) {
  if (role !== "CSKH") return true;
  const scopes = scopeValue?.split(",").map((value) => value.trim()).filter(Boolean) || [];
  return !scopes.length || Boolean(provinceCode && scopes.includes(provinceCode));
}

function buildNotification(order: {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  address: string | null;
  serviceType: string;
  machine: { buildingPhoto: string | null; machinePhoto: string | null };
}, dealer: { phone: string }, baseUrl: string) {
  const content = [
    `KOSOVOTA: Bạn có lệnh dịch vụ mới ${order.orderCode}.`,
    `Khách hàng: ${order.customerName} - ${order.customerPhone}.`,
    `Địa chỉ: ${order.address || "Chưa cập nhật"}.`,
    `Dịch vụ: ${order.serviceType}.`,
    order.machine.buildingPhoto ? `Ảnh tòa nhà: ${baseUrl}${order.machine.buildingPhoto}` : "",
    order.machine.machinePhoto ? `Ảnh vị trí máy: ${baseUrl}${order.machine.machinePhoto}` : "",
    `Chi tiết: ${baseUrl}/agent-portal`,
  ].filter(Boolean).join(" ");

  return {
    phone: dealer.phone,
    channel: "ZALO",
    kind: "SERVICE_ORDER",
    content,
    payload: JSON.stringify({
      templateId: process.env.ZALO_ZBS_SERVICE_ORDER_TEMPLATE_ID || process.env.ZALO_ZBS_TEMPLATE_ID,
      templateData: {
        order_code: order.orderCode,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        address: order.address || "Chưa cập nhật",
        service_name: order.serviceType,
        detail_url: `${baseUrl}/agent-portal`,
      },
    }),
  };
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  try {
    const body = await request.json();
    const dealerId = typeof body.dealerId === "string" ? body.dealerId : "";
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    const serviceType = typeof body.serviceType === "string" ? body.serviceType.trim() : "";
    if (!dealerId || (!orderId && (!machineId || !serviceType))) {
      return NextResponse.json({ success: false, message: "Thiếu đại lý hoặc thông tin lệnh dịch vụ." }, { status: 400 });
    }

    const dealer = await prisma.dealer.findFirst({ where: { id: dealerId, status: "APPROVED" } });
    if (!dealer) return NextResponse.json({ success: false, message: "Đại lý chưa được duyệt." }, { status: 409 });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const include = { dealer: true, machine: { include: { customer: true } } } as const;

    const sourceOrder = orderId ? await prisma.serviceOrder.findUnique({ where: { id: orderId }, include }) : null;
    const machine = sourceOrder?.machine || (machineId ? await prisma.machine.findUnique({ where: { id: machineId }, include: { customer: true } }) : null);
    if (!machine) return NextResponse.json({ success: false, message: "Không tìm thấy máy cần điều phối." }, { status: 404 });
    if (!canAccessProvince(auth.user.role, auth.user.provinceScope, machine.provinceCode)) {
      return NextResponse.json({ success: false, message: "Máy nằm ngoài phạm vi được phân công." }, { status: 403 });
    }

    let newOrderCode: string | null = null;
    if (!sourceOrder) {
      if (!machine.customer?.name || !normalizePhone(machine.customer.phone)) {
        return NextResponse.json({ success: false, message: "Máy chưa có đủ thông tin khách hàng." }, { status: 400 });
      }
      const duplicate = await prisma.serviceOrder.findFirst({
        where: {
          machineId: machine.id,
          serviceType,
          status: { in: ["NEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
          createdAt: { gte: new Date(Date.now() - 5 * 60_000) },
        },
      });
      if (duplicate) {
        return NextResponse.json({ success: false, message: `Máy vừa có lệnh ${duplicate.orderCode} cùng dịch vụ. Hãy kiểm tra trước khi tạo lại.` }, { status: 409 });
      }
      newOrderCode = await createOrderCode(machine.provinceCode || "01");
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = sourceOrder
        ? await tx.serviceOrder.update({
            where: { id: sourceOrder.id },
            data: { dealerId: dealer.id, status: "ASSIGNED", rejectReason: null, rejectedAt: null },
            include,
          })
        : await tx.serviceOrder.create({
            data: {
              orderCode: newOrderCode!,
              machineId: machine.id,
              dealerId: dealer.id,
              customerName: machine.customer!.name,
              customerPhone: normalizePhone(machine.customer!.phone),
              address: machine.customer!.address,
              serviceType,
              status: "ASSIGNED",
            },
            include,
          });
      await tx.notification.create({ data: buildNotification(updated, dealer, baseUrl) });
      await tx.adminLog.create({ data: { userId: auth.user.id, action: "ASSIGN_SERVICE_ORDER", target: updated.orderCode, detail: dealer.dealerCode } });
      return updated;
    });

    await queueDealerServiceOrderEmail({
      dealer,
      orderCode: order.orderCode,
      machineId: order.machineId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address: order.address,
      serviceType: order.serviceType,
    });

    return NextResponse.json({ success: true, message: "Đã giao lệnh và xếp thông báo gửi đại lý.", data: order });
  } catch (error) {
    console.error("assign dealer failed", error);
    return NextResponse.json({ success: false, message: "Không giao được lệnh." }, { status: 500 });
  }
}
