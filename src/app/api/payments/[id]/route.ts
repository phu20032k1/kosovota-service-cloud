import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được duyệt thanh toán." }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const status = String(body.status || "").toUpperCase();
  if (!["DRAFT", "SUBMITTED", "APPROVED", "PAID", "REJECTED"].includes(status)) {
    return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
  }

  const current = await prisma.paymentBatch.findUnique({ where: { id }, include: { lines: true } });
  if (!current) return NextResponse.json({ success: false, message: "Không tìm thấy kỳ đối soát." }, { status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.paymentBatch.update({ where: { id }, data: {
      status,
      approvedAt: status === "APPROVED" ? new Date() : current.approvedAt,
      paidAt: status === "PAID" ? new Date() : current.paidAt,
      bankReference: typeof body.bankReference === "string" ? body.bankReference.trim() || null : current.bankReference,
      note: typeof body.note === "string" ? body.note.trim() || null : current.note,
    } });
    const orderIds = current.lines.map((line) => line.serviceOrderId);
    if (status === "PAID") await tx.serviceOrder.updateMany({ where: { id: { in: orderIds } }, data: { paymentStatus: "PAID" } });
    if (status === "APPROVED") await tx.serviceOrder.updateMany({ where: { id: { in: orderIds } }, data: { paymentStatus: "APPROVED" } });
    if (status === "REJECTED") await tx.serviceOrder.updateMany({ where: { id: { in: orderIds } }, data: { paymentStatus: "PENDING" } });
    return updated;
  });
  await writeAudit({ request, userId: auth.user.id, action: "UPDATE_PAYMENT_BATCH", target: current.batchCode, detail: { from: current.status, to: status, bankReference: body.bankReference || null } });
  return NextResponse.json({ success: true, message: "Đã cập nhật đối soát.", data: result });
}
