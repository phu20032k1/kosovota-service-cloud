import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueTechnicianAssignedEmail } from "@/lib/notifications/events";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["DEALER"]);
  if (!auth?.user.dealerCode) return NextResponse.json({ success: false, message: "Tài khoản chưa liên kết đại lý." }, { status: 403 });
  try {
    const { id } = await params;
    const body = await request.json();
    const technicianId = typeof body.technicianId === "string" && body.technicianId ? body.technicianId : null;
    const order = await prisma.serviceOrder.findUnique({ where: { id }, include: { dealer: true, machine: { include: { customer: true } } } });
    if (!order || order.dealer?.dealerCode !== auth.user.dealerCode) {
      return NextResponse.json({ success: false, message: "Lệnh không thuộc đại lý này." }, { status: 404 });
    }
    if (["COMPLETED", "CANCELLED"].includes(order.status)) {
      return NextResponse.json({ success: false, message: "Không thể đổi KTV của lệnh đã kết thúc." }, { status: 409 });
    }
    if (technicianId) {
      const technician = await prisma.user.findFirst({ where: { id: technicianId, role: "KTV", dealerCode: auth.user.dealerCode, active: true } });
      if (!technician) return NextResponse.json({ success: false, message: "KTV không hợp lệ hoặc đã bị khóa." }, { status: 400 });
    }
    const updated = await prisma.serviceOrder.update({
      where: { id },
      data: { technicianId, status: technicianId && order.status === "NEW" ? "ASSIGNED" : undefined },
      include: { technician: { select: { id: true, name: true, phone: true, email: true } } },
    });
    if (technicianId && updated.technician) {
      await queueTechnicianAssignedEmail({
        technician: updated.technician,
        orderCode: order.orderCode,
        machineId: order.machineId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address: order.address,
        serviceType: order.serviceType,
        dueDate: order.dueDate,
      });
    }
    return NextResponse.json({ success: true, message: technicianId ? "Đã giao lệnh cho KTV." : "Đã bỏ phân công KTV.", data: updated });
  } catch (error) {
    console.error("assign technician failed", error);
    return NextResponse.json({ success: false, message: "Không giao được KTV." }, { status: 500 });
  }
}
