import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["SALES_MANAGER"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 403 });
  try {
    const { id } = await params;
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action.toUpperCase() : "";
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket || ticket.type !== "MATERIAL_SALE") return NextResponse.json({ success: false, message: "Không tìm thấy cơ hội bán lõi." }, { status: 404 });

    if (action === "ASSIGN") {
      const assigneeId = typeof body.assigneeId === "string" ? body.assigneeId : "";
      const assignee = await prisma.user.findFirst({ where: { id: assigneeId, active: true, role: { in: ["SALES_MANAGER", "CSKH"] } } });
      if (!assignee) return NextResponse.json({ success: false, message: "Người phụ trách không hợp lệ." }, { status: 400 });
      await prisma.supportTicket.update({ where: { id }, data: { assigneeId } });
      await writeAudit({ request, userId: auth.user.id, action: "ASSIGN_SALES_OPPORTUNITY", target: ticket.ticketCode, detail: { assigneeId } });
      return NextResponse.json({ success: true, message: "Đã đổi người phụ trách." });
    }

    if (action === "CONTACTED") {
      await prisma.$transaction([
        prisma.supportTicket.update({ where: { id }, data: { status: "ASSIGNED", assigneeId: ticket.assigneeId || auth.user.id } }),
        prisma.ticketMessage.create({ data: { ticketId: id, authorId: auth.user.id, authorName: auth.user.name, message: "SALE_CONTACTED|Đã liên hệ khách hàng", isInternal: true } }),
      ]);
      return NextResponse.json({ success: true, message: "Đã ghi nhận đã liên hệ." });
    }

    if (action === "SOLD") {
      const value = Math.round(Number(body.value));
      if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ success: false, message: "Đã bán bắt buộc nhập giá trị lớn hơn 0." }, { status: 400 });
      await prisma.$transaction([
        prisma.supportTicket.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date(), assigneeId: ticket.assigneeId || auth.user.id } }),
        prisma.ticketMessage.create({ data: { ticketId: id, authorId: auth.user.id, authorName: auth.user.name, message: `SALE_SOLD|${value}`, isInternal: true } }),
      ]);
      await writeAudit({ request, userId: auth.user.id, action: "CLOSE_SALES_OPPORTUNITY_SOLD", target: ticket.ticketCode, detail: { value } });
      return NextResponse.json({ success: true, message: "Đã chốt cơ hội là Đã bán." });
    }

    if (action === "NOT_BUY") {
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      await prisma.$transaction([
        prisma.supportTicket.update({ where: { id }, data: { status: "CANCELLED", resolvedAt: new Date() } }),
        prisma.ticketMessage.create({ data: { ticketId: id, authorId: auth.user.id, authorName: auth.user.name, message: `SALE_NOT_BUY|${reason || "Khách không mua"}`, isInternal: true } }),
      ]);
      return NextResponse.json({ success: true, message: "Đã ghi nhận khách không mua." });
    }

    return NextResponse.json({ success: false, message: "Thao tác không hợp lệ." }, { status: 400 });
  } catch (error) {
    console.error("sales opportunity action failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được cơ hội bán lõi." }, { status: 500 });
  }
}
