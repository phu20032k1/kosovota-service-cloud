import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["DEALER", "CTV"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const appointmentAt = new Date(String(body.appointmentAt || ""));
    const technicianId = typeof body.technicianId === "string" && body.technicianId.trim() ? body.technicianId.trim() : null;

    if (Number.isNaN(appointmentAt.getTime()) || appointmentAt.getTime() < Date.now() - 5 * 60_000) {
      return NextResponse.json({ success: false, message: "Vui lòng chọn giờ hẹn hợp lệ." }, { status: 400 });
    }
    if (!auth.user.dealerCode) {
      return NextResponse.json({ success: false, message: "Tài khoản chưa liên kết đại lý." }, { status: 403 });
    }

    const dealer = await prisma.dealer.findUnique({ where: { dealerCode: auth.user.dealerCode } });
    if (!dealer) return NextResponse.json({ success: false, message: "Không tìm thấy hồ sơ đại lý." }, { status: 404 });

    if (technicianId) {
      const technician = await prisma.user.findUnique({ where: { id: technicianId } });
      if (!technician?.active || technician.role !== "KTV" || technician.dealerCode !== auth.user.dealerCode) {
        return NextResponse.json({ success: false, message: "Kỹ thuật viên không hợp lệ hoặc không thuộc đại lý này." }, { status: 400 });
      }
    }

    const result = await prisma.serviceOrder.updateMany({
      where: { id, dealerId: dealer.id, status: "ASSIGNED" },
      data: { status: "ACCEPTED", dueDate: appointmentAt, technicianId, rejectReason: null, rejectedAt: null },
    });
    if (result.count !== 1) {
      return NextResponse.json({ success: false, message: "Lệnh đã được xử lý ở thiết bị khác hoặc không còn chờ nhận." }, { status: 409 });
    }

    await writeAudit({
      request,
      userId: auth.user.id,
      action: "ACCEPT_SERVICE_ORDER",
      target: id,
      detail: { appointmentAt: appointmentAt.toISOString(), technicianId, selfAssigned: !technicianId },
    });

    return NextResponse.json({ success: true, message: technicianId ? "Đã nhận lệnh và giao kỹ thuật viên." : "Đã nhận lệnh. Bạn sẽ tự thực hiện lệnh này." });
  } catch (error) {
    console.error("accept dealer order failed", error);
    return NextResponse.json({ success: false, message: "Không nhận được lệnh lúc này." }, { status: 500 });
  }
}
