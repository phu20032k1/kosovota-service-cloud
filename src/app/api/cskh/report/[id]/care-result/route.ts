import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { careLabelStatus } from "@/lib/cskh-report";
import { provinceScopeAllows } from "@/lib/province-access";

const MARKER_PREFIX = "[service-order:";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["SUPER_ADMIN", "ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const status = careLabelStatus(label);
    if (!label || !status) return NextResponse.json({ success: false, message: "Kết quả chăm sóc không hợp lệ." }, { status: 400 });

    const order = await prisma.serviceOrder.findUnique({
      where: { id },
      include: { machine: { include: { customer: true } } },
    });
    if (!order) return NextResponse.json({ success: false, message: "Không tìm thấy lệnh chăm sóc." }, { status: 404 });

    if (auth.user.role === "CSKH" && !provinceScopeAllows(
      auth.user.provinceScope,
      order.machine.provinceCode,
      order.machine.customer?.address || order.address,
    )) {
      return NextResponse.json({ success: false, message: "Lệnh nằm ngoài phạm vi CSKH được phân công." }, { status: 403 });
    }
    if (!order.machine.customer?.id) return NextResponse.json({ success: false, message: "Máy chưa gắn khách hàng." }, { status: 409 });

    const marker = `${MARKER_PREFIX}${order.id}]`;
    const previous = await prisma.customerActivity.findFirst({
      where: { customerId: order.machine.customer.id, type: "CARE_RESULT", detail: { contains: marker } },
      orderBy: { occurredAt: "desc" },
    });
    if (previous?.summary === label) {
      return NextResponse.json({ success: true, message: "Kết quả chăm sóc đã được ghi nhận.", data: previous });
    }

    const now = new Date();
    const activity = await prisma.$transaction(async (tx) => {
      const created = await tx.customerActivity.create({
        data: {
          customerId: order.machine.customer!.id,
          type: "CARE_RESULT",
          summary: label,
          detail: `Kết quả chăm sóc của ${order.orderCode}. ${marker}`,
          userId: auth.user.id,
          occurredAt: now,
        },
      });
      await tx.customer.update({ where: { id: order.machine.customer!.id }, data: { lastContactAt: now } });
      return created;
    });

    return NextResponse.json({ success: true, message: "Đã lưu kết quả chăm sóc vào lịch sử khách hàng.", data: activity }, { status: 201 });
  } catch (error) {
    console.error("POST /api/cskh/report/[id]/care-result failed", error);
    return NextResponse.json({ success: false, message: "Không lưu được kết quả chăm sóc." }, { status: 500 });
  }
}
