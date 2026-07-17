import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, hasRole } from "@/lib/auth";
import { queueSosNotifications } from "@/lib/notifications/events";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const scopes = auth.user.provinceScope?.split(",").map((v: string) => v.trim()).filter(Boolean) || [];
  const tickets = await prisma.sosTicket.findMany({
    where: auth.user.role === "CSKH" && scopes.length ? { machine: { provinceCode: { in: scopes } } } : undefined,
    include: { machine: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ success: true, data: tickets });
}

export async function POST(request: NextRequest) {
  try {
    const [staff, customerSession] = await Promise.all([
      hasRole(request, ["ADMIN", "CSKH"]),
      getCustomerSession(request),
    ]);
    if (!staff && !customerSession) return NextResponse.json({ success: false, message: "Cần xác thực chủ máy." }, { status: 401 });
    const body = await request.json();
    const machineId = typeof body.machineId === "string" ? body.machineId : "";
    const machine = await prisma.machine.findUnique({ where: { id: machineId }, include: { customer: true } });
    if (!machine?.customer) return NextResponse.json({ success: false, message: "Không tìm thấy chủ máy." }, { status: 404 });
    if (customerSession && machine.customer.phone !== customerSession.phone) {
      return NextResponse.json({ success: false, message: "Chỉ chủ máy mới được tạo yêu cầu SOS." }, { status: 403 });
    }
    const existing = await prisma.sosTicket.findFirst({ where: { machineId, status: { in: ["NEW", "PROCESSING", "ORDER_CREATED"] } } });
    if (existing) return NextResponse.json({ success: true, message: "Máy đã có yêu cầu SOS đang được xử lý.", data: existing });
    const ticket = await prisma.sosTicket.create({
      data: {
        machineId,
        customerName: machine.customer.name,
        customerPhone: machine.customer.phone,
        address: machine.customer.address,
        note: typeof body.note === "string" ? body.note || null : null,
        status: "NEW",
        priority: "HIGH",
      },
    });
    await queueSosNotifications({
      ticketId: ticket.id,
      machineId,
      customer: machine.customer,
      note: ticket.note,
    });
    return NextResponse.json({ success: true, message: "Đã gửi SOS. CSKH sẽ xử lý ngay.", data: ticket }, { status: 201 });
  } catch (error) {
    console.error("POST SOS failed", error);
    return NextResponse.json({ success: false, message: "Không tạo được yêu cầu SOS." }, { status: 500 });
  }
}
