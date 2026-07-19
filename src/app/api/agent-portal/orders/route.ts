import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["DEALER", "CTV", "KTV"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const dealerCode = auth.user.dealerCode;
    if (!dealerCode) return NextResponse.json({ success: false, message: "Tài khoản chưa liên kết đại lý." }, { status: 403 });
    const dealer = await prisma.dealer.findUnique({ where: { dealerCode } });
    if (!dealer) return NextResponse.json({ success: false, message: "Không tìm thấy hồ sơ đại lý." }, { status: 404 });

    const orders = await prisma.serviceOrder.findMany({
      where: auth.user.role === "KTV" ? { technicianId: auth.user.id } : { dealerId: dealer.id },
      include: {
        machine: { include: { customer: true } },
        reports: true,
        technician: { select: { id: true, name: true, phone: true, active: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    const completed = orders.filter((order) => order.status === "COMPLETED");
    const revenue = ["DEALER", "CTV"].includes(auth.user.role) ? completed.reduce((sum, order) => sum + (order.serviceFee || 0), 0) : 0;
    const paid = ["DEALER", "CTV"].includes(auth.user.role) ? completed.filter((order) => order.paymentStatus === "PAID").reduce((sum, order) => sum + (order.serviceFee || 0), 0) : 0;
    return NextResponse.json({ success: true, dealer, data: orders, summary: { revenue, paid, pending: revenue - paid }, scope: auth.user.role });
  } catch (error) {
    console.error("agent orders failed", error);
    return NextResponse.json({ success: false, message: "Không tải được lệnh dịch vụ." }, { status: 500 });
  }
}
