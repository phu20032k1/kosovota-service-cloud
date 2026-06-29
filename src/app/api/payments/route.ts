import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { createPaymentBatchCode } from "@/lib/enterprise-codes";
import { writeAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "DEALER"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  const batches = await prisma.paymentBatch.findMany({
    where: auth.user.role === "DEALER" ? { dealer: { dealerCode: auth.user.dealerCode || "__NONE__" } } : {},
    include: {
      dealer: { select: { dealerCode: true, name: true, bankAccount: true, accountHolder: true, bankName: true } },
      lines: { include: { serviceOrder: { select: { orderCode: true, serviceType: true, updatedAt: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const eligibleOrders = ["ADMIN", "SUPER_ADMIN"].includes(auth.user.role) ? await prisma.serviceOrder.findMany({
    where: { status: "COMPLETED", paymentStatus: "PENDING", dealerId: { not: null }, paymentLine: null },
    include: { dealer: true, stockMovements: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  }) : [];

  const dealers = ["ADMIN", "SUPER_ADMIN"].includes(auth.user.role) ? await prisma.dealer.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" } }) : [];
  const summary = batches.reduce((acc, batch) => {
    acc.total += batch.netAmount;
    if (batch.status === "PAID") acc.paid += batch.netAmount;
    else if (["SUBMITTED", "APPROVED"].includes(batch.status)) acc.pending += batch.netAmount;
    return acc;
  }, { total: 0, paid: 0, pending: 0 });

  return NextResponse.json({ success: true, data: { batches, eligibleOrders, dealers, summary } });
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được tạo kỳ đối soát." }, { status: 403 });

  try {
    const body = await request.json();
    const dealerId = String(body.dealerId || "");
    const periodStart = new Date(body.periodStart);
    const periodEnd = new Date(body.periodEnd);
    if (!dealerId || Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart > periodEnd) {
      return NextResponse.json({ success: false, message: "Đại lý hoặc kỳ đối soát không hợp lệ." }, { status: 400 });
    }
    periodEnd.setHours(23, 59, 59, 999);

    const orders = await prisma.serviceOrder.findMany({
      where: {
        dealerId, status: "COMPLETED", paymentStatus: "PENDING", paymentLine: null,
        updatedAt: { gte: periodStart, lte: periodEnd },
      },
      include: { stockMovements: true },
    });
    if (!orders.length) return NextResponse.json({ success: false, message: "Không có lệnh đủ điều kiện trong kỳ này." }, { status: 400 });

    const batchCode = await createPaymentBatchCode();
    const result = await prisma.$transaction(async (tx) => {
      const lines = orders.map((order) => {
        const serviceAmount = order.serviceFee || 0;
        const materialAmount = order.stockMovements.reduce((sum, movement) => sum + movement.quantity * movement.unitCost, 0);
        const bonusAmount = 0;
        const deductionAmount = 0;
        return { order, serviceAmount, materialAmount, bonusAmount, deductionAmount, totalAmount: serviceAmount + materialAmount + bonusAmount - deductionAmount };
      });
      const grossAmount = lines.reduce((sum, line) => sum + line.serviceAmount + line.materialAmount + line.bonusAmount, 0);
      const deductions = lines.reduce((sum, line) => sum + line.deductionAmount, 0);
      const batch = await tx.paymentBatch.create({ data: {
        batchCode, dealerId, periodStart, periodEnd, status: "SUBMITTED", grossAmount, deductions,
        netAmount: grossAmount - deductions, note: typeof body.note === "string" ? body.note.trim() || null : null,
        createdById: auth.user.id,
        lines: { create: lines.map((line) => ({
          serviceOrderId: line.order.id, serviceAmount: line.serviceAmount, materialAmount: line.materialAmount,
          bonusAmount: line.bonusAmount, deductionAmount: line.deductionAmount, totalAmount: line.totalAmount,
        })) },
      }, include: { dealer: true, lines: true } });
      await tx.serviceOrder.updateMany({ where: { id: { in: orders.map((order) => order.id) } }, data: { paymentStatus: "SUBMITTED" } });
      return batch;
    });

    await writeAudit({ request, userId: auth.user.id, action: "CREATE_PAYMENT_BATCH", target: batchCode, detail: { dealerId, orderCount: orders.length, netAmount: result.netAmount } });
    return NextResponse.json({ success: true, message: `Đã tạo đối soát ${batchCode}.`, data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/payments failed", error);
    return NextResponse.json({ success: false, message: "Không tạo được kỳ đối soát." }, { status: 500 });
  }
}
