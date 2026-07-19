import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const reports = await prisma.serviceReport.findMany({ include: { machine: { include: { customer: true } }, order: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ success: true, data: reports });
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["DEALER", "CTV", "KTV"]);
  if (!auth?.user.dealerCode) return NextResponse.json({ success: false, message: "Cần đăng nhập Đại lý hoặc KTV." }, { status: 401 });
  try {
    const body = await request.json();
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    const dealerCode = auth.user.dealerCode;
    const serviceType = typeof body.serviceType === "string" ? body.serviceType.trim() : "";
    const oldCorePhoto = typeof body.oldCorePhoto === "string" ? body.oldCorePhoto.trim() : "";
    const newCorePhoto = typeof body.newCorePhoto === "string" ? body.newCorePhoto.trim() : "";
    const signature = typeof body.signature === "string" ? body.signature.trim() : "";
    if (!machineId || !dealerCode || !serviceType || !oldCorePhoto || !newCorePhoto || !signature) {
      return NextResponse.json({ success: false, message: "Thiếu mã máy, đại lý, dịch vụ, hai ảnh lõi hoặc chữ ký." }, { status: 400 });
    }
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const [machine, dealer, order] = await Promise.all([
      prisma.machine.findUnique({ where: { id: machineId } }),
      prisma.dealer.findFirst({ where: { dealerCode, status: "APPROVED" } }),
      orderId ? prisma.serviceOrder.findUnique({ where: { id: orderId }, include: { dealer: true, reports: { select: { id: true }, take: 1 } } }) : Promise.resolve(null),
    ]);
    if (!machine) return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });
    if (!dealer) return NextResponse.json({ success: false, message: "Mã đại lý chưa được duyệt." }, { status: 409 });
    if (orderId) {
      if (!order || order.machineId !== machineId) return NextResponse.json({ success: false, message: "Lệnh dịch vụ không khớp với máy." }, { status: 404 });
      if (order.dealer?.dealerCode !== dealerCode) return NextResponse.json({ success: false, message: "Lệnh không thuộc đại lý này." }, { status: 403 });
      if (auth.user.role === "KTV" && order.technicianId !== auth.user.id) return NextResponse.json({ success: false, message: "Lệnh chưa được giao cho KTV này." }, { status: 403 });
      if (order.status === "COMPLETED" || order.reports.length) return NextResponse.json({ success: false, message: "Lệnh đã có báo cáo hoàn thành." }, { status: 409 });
      if (!["ACCEPTED", "IN_PROGRESS"].includes(order.status)) return NextResponse.json({ success: false, message: "Cần nhận và bắt đầu lệnh trước khi báo cáo." }, { status: 400 });
    }

    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceReport.create({
        data: {
          machineId, orderId: orderId || null,
          dealerCode, serviceType,
          products: typeof body.products === "string" ? body.products || null : null,
          oldCorePhoto, newCorePhoto,
          finalPhoto: typeof body.finalPhoto === "string" ? body.finalPhoto || null : null,
          signature, note: typeof body.note === "string" ? body.note || null : null,
        },
      });
      if (orderId) {
        const order = await tx.serviceOrder.update({ where: { id: orderId }, data: { status: "COMPLETED" } });
        if (order.maintenanceScheduleId) await tx.maintenanceSchedule.update({ where: { id: order.maintenanceScheduleId }, data: { status: "COMPLETED" } });
      }
      return created;
    });
    return NextResponse.json({ success: true, message: "Báo cáo dịch vụ đã được ghi nhận.", data: report }, { status: 201 });
  } catch (error) {
    console.error("POST service report failed", error);
    return NextResponse.json({ success: false, message: "Không lưu được báo cáo dịch vụ." }, { status: 500 });
  }
}
