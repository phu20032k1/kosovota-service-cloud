import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { createTicketCode } from "@/lib/enterprise-codes";
import { createOrderCode } from "@/lib/order-code";
import { writeAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";
import { queueServiceOrderCreatedNotifications } from "@/lib/notifications/events";

const include = {
  customer: true,
  machine: { select: { id: true, model: true, name: true, status: true, provinceCode: true } },
  dealer: { select: { id: true, dealerCode: true, name: true } },
  assignee: { select: { id: true, name: true, role: true } },
  serviceOrder: {
    include: {
      dealer: { select: { id: true, dealerCode: true, name: true } },
      technician: { select: { id: true, name: true, phone: true } },
      reports: { orderBy: { createdAt: "desc" as const }, take: 3 },
    },
  },
  messages: { orderBy: { createdAt: "asc" as const } },
};

const DEALER_OPERATOR_ROLES = new Set(["DEALER", "CTV"]);
const OPERATIONAL_TICKET_TYPES = new Set(["WARRANTY", "REPAIR", "MAINTENANCE", "INSTALLATION", "COMPLAINT"]);

function serviceTypeFromTicket(type: string, subject: string) {
  const normalized = type.toUpperCase();
  const prefix: Record<string, string> = {
    WARRANTY: "Bảo hành",
    REPAIR: "Sửa chữa",
    MAINTENANCE: "Bảo trì",
    INSTALLATION: "Lắp đặt",
    COMPLAINT: "Kiểm tra khiếu nại",
  };
  return `${prefix[normalized] || "Dịch vụ"}: ${subject}`.slice(0, 240);
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH", "DEALER", "CTV"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const status = request.nextUrl.searchParams.get("status") || undefined;
  const priority = request.nextUrl.searchParams.get("priority") || undefined;
  const dealerOperator = DEALER_OPERATOR_ROLES.has(auth.user.role);
  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(dealerOperator ? { dealer: { dealerCode: auth.user.dealerCode || "__NONE__" } } : {}),
      ...(auth.user.role === "CSKH" && auth.user.provinceScope ? {
        OR: [
          { assigneeId: auth.user.id },
          { machine: { provinceCode: { in: auth.user.provinceScope.split(",").map((v) => v.trim()).filter(Boolean) } } },
        ],
      } : {}),
    },
    include,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  const [customers, machines, dealers, staff] = dealerOperator ? [[], [], [], []] : await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, take: 1000 }),
    prisma.machine.findMany({ include: { customer: true }, orderBy: { updatedAt: "desc" }, take: 2000 }),
    prisma.dealer.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true, role: { in: ["ADMIN", "CSKH"] } }, select: { id: true, name: true, role: true } }),
  ]);
  return NextResponse.json({ success: true, data: { tickets, customers, machines, dealers, staff } });
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH", "DEALER", "CTV"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const body = await request.json();
    const subject = String(body.subject || "").trim();
    const contactName = String(body.contactName || "").trim();
    const contactPhone = normalizePhone(body.contactPhone);
    const ticketType = String(body.type || "WARRANTY").toUpperCase();
    const dealerOperator = DEALER_OPERATOR_ROLES.has(auth.user.role);
    if (!subject || !contactName || !contactPhone) {
      return NextResponse.json({ success: false, message: "Thiếu tiêu đề hoặc thông tin liên hệ." }, { status: 400 });
    }

    const requestedMachineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    const requestedCustomerId = typeof body.customerId === "string" ? body.customerId.trim() : "";
    const [requestedMachine, requestedCustomer, phoneCustomer] = await Promise.all([
      requestedMachineId ? prisma.machine.findUnique({ where: { id: requestedMachineId }, include: { customer: true } }) : null,
      requestedCustomerId ? prisma.customer.findUnique({ where: { id: requestedCustomerId }, include: { machines: { orderBy: { updatedAt: "desc" }, take: 2 } } }) : null,
      prisma.customer.findUnique({ where: { phone: contactPhone }, include: { machines: { orderBy: { updatedAt: "desc" }, take: 2 } } }),
    ]);

    const customer = requestedMachine?.customer || requestedCustomer || phoneCustomer || null;
    const inferredMachine = requestedMachine
      || (requestedCustomer?.machines.length === 1 ? requestedCustomer.machines[0] : null)
      || (phoneCustomer?.machines.length === 1 ? phoneCustomer.machines[0] : null);
    const dealer = dealerOperator
      ? await prisma.dealer.findUnique({ where: { dealerCode: auth.user.dealerCode || "__NONE__" } })
      : null;
    const selectedDealerId = dealerOperator ? dealer?.id || null : (typeof body.dealerId === "string" && body.dealerId ? body.dealerId : null);
    const shouldCreateOrder = Boolean(inferredMachine && OPERATIONAL_TICKET_TYPES.has(ticketType));
    const ticketCode = await createTicketCode();
    const orderCode = shouldCreateOrder ? await createOrderCode(inferredMachine?.provinceCode || "01") : null;
    const dueAt = body.dueAt ? new Date(body.dueAt) : null;

    const created = await prisma.$transaction(async (tx) => {
      let serviceOrder = null;
      if (shouldCreateOrder && inferredMachine && orderCode) {
        serviceOrder = await tx.serviceOrder.create({
          data: {
            orderCode,
            machineId: inferredMachine.id,
            dealerId: selectedDealerId,
            customerName: customer?.name || contactName,
            customerPhone: customer?.phone || contactPhone,
            address: customer?.address || null,
            serviceType: serviceTypeFromTicket(ticketType, subject),
            status: selectedDealerId ? "ASSIGNED" : "NEW",
            dueDate: dueAt,
          },
        });
      }

      const ticket = await tx.supportTicket.create({
        data: {
          ticketCode,
          type: ticketType,
          source: dealerOperator ? auth.user.role : String(body.source || "STAFF"),
          subject,
          description: typeof body.description === "string" ? body.description.trim() || null : null,
          priority: String(body.priority || "NORMAL").toUpperCase(),
          customerId: customer?.id || null,
          machineId: inferredMachine?.id || null,
          dealerId: selectedDealerId,
          assigneeId: dealerOperator ? null : body.assigneeId || null,
          serviceOrderId: serviceOrder?.id || null,
          contactName,
          contactPhone,
          dueAt,
        },
        include,
      });
      if (ticket.customerId) {
        await tx.customerActivity.create({
          data: {
            customerId: ticket.customerId,
            type: "TICKET",
            summary: `Tạo yêu cầu ${ticketCode}: ${subject}`,
            detail: serviceOrder ? `Đã tự động tạo lệnh điều phối ${serviceOrder.orderCode}. ${ticket.description || ""}`.trim() : ticket.description,
            userId: auth.user.id,
          },
        });
      }
      return ticket;
    });

    if (created.serviceOrder && customer) {
      await queueServiceOrderCreatedNotifications({
        orderCode: created.serviceOrder.orderCode,
        machineId: created.serviceOrder.machineId,
        serviceType: created.serviceOrder.serviceType,
        dueDate: created.serviceOrder.dueDate,
        customer,
      });
    }
    await writeAudit({
      request,
      userId: auth.user.id,
      action: "CREATE_SUPPORT_TICKET",
      target: ticketCode,
      detail: { subject, priority: created.priority, serviceOrder: created.serviceOrder?.orderCode || null },
    });
    return NextResponse.json({
      success: true,
      message: created.serviceOrder
        ? `Đã tạo ${ticketCode} và tự động chuyển sang Điều phối bằng lệnh ${created.serviceOrder.orderCode}.`
        : `Đã tạo yêu cầu ${ticketCode}. Chọn đúng máy để hệ thống tự tạo lệnh Điều phối.`,
      data: created,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/support-tickets failed", error);
    return NextResponse.json({ success: false, message: "Không tạo được yêu cầu hỗ trợ." }, { status: 500 });
  }
}
