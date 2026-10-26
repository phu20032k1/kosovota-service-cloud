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
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 3) return NextResponse.json({ success: false, message: "Vui lòng ghi lý do từ chối." }, { status: 400 });
    if (!auth.user.dealerCode) return NextResponse.json({ success: false, message: "Tài khoản chưa liên kết đại lý." }, { status: 403 });

    const dealer = await prisma.dealer.findUnique({ where: { dealerCode: auth.user.dealerCode } });
    if (!dealer) return NextResponse.json({ success: false, message: "Không tìm thấy hồ sơ đại lý." }, { status: 404 });

    const result = await prisma.serviceOrder.updateMany({
      where: { id, dealerId: dealer.id, status: "ASSIGNED" },
      data: { status: "NEW", dealerId: null, technicianId: null, rejectReason: reason, rejectedAt: new Date() },
    });
    if (result.count !== 1) return NextResponse.json({ success: false, message: "Lệnh đã được xử lý ở thiết bị khác hoặc không còn chờ nhận." }, { status: 409 });

    await writeAudit({ request, userId: auth.user.id, action: "REJECT_SERVICE_ORDER", target: id, detail: { reason } });
    return NextResponse.json({ success: true, message: "Đã từ chối lệnh và trả lại hàng chờ điều phối." });
  } catch (error) {
    console.error("reject dealer order failed", error);
    return NextResponse.json({ success: false, message: "Không từ chối được lệnh lúc này." }, { status: 500 });
  }
}
