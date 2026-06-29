import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { createTicketCode } from "@/lib/enterprise-codes";
import { writeAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";

const include = {
  customer: true,
  machine: { select: { id: true, model: true, status: true } },
  dealer: { select: { id: true, dealerCode: true, name: true } },
  assignee: { select: { id: true, name: true, role: true } },
  messages: { orderBy: { createdAt: "asc" as const } },
};

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH", "DEALER"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const status = request.nextUrl.searchParams.get("status") || undefined;
  const priority = request.nextUrl.searchParams.get("priority") || undefined;
  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(status ? { status } : {}), ...(priority ? { priority } : {}),
      ...(auth.user.role === "DEALER" ? { dealer: { dealerCode: auth.user.dealerCode || "__NONE__" } } : {}),
      ...(auth.user.role === "CSKH" && auth.user.provinceScope ? {
        OR: [
          { assigneeId: auth.user.id },
          { machine: { provinceCode: { in: auth.user.provinceScope.split(",").map((v) => v.trim()).filter(Boolean) } } },
        ],
      } : {}),
    }, include, orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 500,
  });
  const [customers, machines, dealers, staff] = auth.user.role === "DEALER" ? [[], [], [], []] : await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, take: 1000 }),
    prisma.machine.findMany({ include: { customer: true }, orderBy: { updatedAt: "desc" }, take: 1000 }),
    prisma.dealer.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true, role: { in: ["ADMIN", "CSKH"] } }, select: { id: true, name: true, role: true } }),
  ]);
  return NextResponse.json({ success: true, data: { tickets, customers, machines, dealers, staff } });
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH", "DEALER"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const body = await request.json();
    const subject = String(body.subject || "").trim();
    const contactName = String(body.contactName || "").trim();
    const contactPhone = normalizePhone(body.contactPhone);
    if (!subject || !contactName || !contactPhone) return NextResponse.json({ success: false, message: "Thiếu tiêu đề hoặc thông tin liên hệ." }, { status: 400 });
    const ticketCode = await createTicketCode();
    const dealer = auth.user.role === "DEALER" ? await prisma.dealer.findUnique({ where: { dealerCode: auth.user.dealerCode || "__NONE__" } }) : null;
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({ data: {
        ticketCode, type: String(body.type || "WARRANTY"), source: auth.user.role === "DEALER" ? "DEALER" : String(body.source || "STAFF"),
        subject, description: typeof body.description === "string" ? body.description.trim() || null : null,
        priority: String(body.priority || "NORMAL"), customerId: body.customerId || null, machineId: body.machineId || null,
        dealerId: auth.user.role === "DEALER" ? dealer?.id || null : body.dealerId || null,
        assigneeId: auth.user.role === "DEALER" ? null : body.assigneeId || null,
        contactName, contactPhone, dueAt: body.dueAt ? new Date(body.dueAt) : null,
      }, include });
      if (created.customerId) await tx.customerActivity.create({ data: {
        customerId: created.customerId, type: "TICKET", summary: `Tạo yêu cầu ${ticketCode}: ${subject}`,
        detail: created.description, userId: auth.user.id,
      } });
      return created;
    });
    await writeAudit({ request, userId: auth.user.id, action: "CREATE_SUPPORT_TICKET", target: ticketCode, detail: { subject, priority: ticket.priority } });
    return NextResponse.json({ success: true, message: `Đã tạo yêu cầu ${ticketCode}.`, data: ticket }, { status: 201 });
  } catch (error) {
    console.error("POST /api/support-tickets failed", error);
    return NextResponse.json({ success: false, message: "Không tạo được yêu cầu hỗ trợ." }, { status: 500 });
  }
}
