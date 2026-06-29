import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "CSKH", "DEALER"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const current = await prisma.supportTicket.findUnique({ where: { id }, include: { dealer: true } });
  if (!current) return NextResponse.json({ success: false, message: "Không tìm thấy yêu cầu." }, { status: 404 });
  if (auth.user.role === "DEALER" && current.dealer?.dealerCode !== auth.user.dealerCode) return NextResponse.json({ success: false, message: "Yêu cầu không thuộc đại lý." }, { status: 403 });

  const status = typeof body.status === "string" ? body.status.toUpperCase() : undefined;
  const allowed = ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "CANCELLED"];
  if (status && !allowed.includes(status)) return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
  const updateData: Record<string, unknown> = {
    ...(status ? { status, resolvedAt: ["RESOLVED", "CLOSED"].includes(status) ? new Date() : null } : {}),
    ...(auth.user.role !== "DEALER" && typeof body.priority === "string" ? { priority: body.priority } : {}),
    ...(auth.user.role !== "DEALER" && "assigneeId" in body ? { assigneeId: body.assigneeId || null } : {}),
    ...(auth.user.role !== "DEALER" && "dealerId" in body ? { dealerId: body.dealerId || null } : {}),
    ...(body.dueAt ? { dueAt: new Date(body.dueAt) } : {}),
    ...(Number.isInteger(body.satisfaction) ? { satisfaction: Math.min(5, Math.max(1, body.satisfaction)) } : {}),
  };

  const updated = await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.update({ where: { id }, data: updateData });
    if (typeof body.message === "string" && body.message.trim()) {
      await tx.ticketMessage.create({ data: {
        ticketId: id, authorId: auth.user.id, authorName: auth.user.name, message: body.message.trim(),
        attachment: typeof body.attachment === "string" ? body.attachment || null : null,
        isInternal: Boolean(body.isInternal) && auth.user.role !== "DEALER",
      } });
    }
    if (ticket.customerId && (status || (typeof body.message === "string" && body.message.trim()))) {
      await tx.customerActivity.create({ data: {
        customerId: ticket.customerId, type: status ? "TICKET_STATUS" : "TICKET_MESSAGE",
        summary: status ? `${ticket.ticketCode} chuyển trạng thái ${status}` : `Trao đổi tại ${ticket.ticketCode}`,
        detail: typeof body.message === "string" ? body.message.trim() || null : null, userId: auth.user.id,
      } });
    }
    return ticket;
  });
  await writeAudit({ request, userId: auth.user.id, action: "UPDATE_SUPPORT_TICKET", target: current.ticketCode, detail: { status, assigneeId: body.assigneeId, dealerId: body.dealerId } });
  return NextResponse.json({ success: true, message: "Đã cập nhật yêu cầu.", data: updated });
}
