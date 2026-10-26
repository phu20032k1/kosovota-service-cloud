import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth";
import { createTicketCode } from "@/lib/enterprise-codes";
import { createOrderCode } from "@/lib/order-code";
import { prisma } from "@/lib/prisma";

const MAX_IMAGES = 4;
const OPEN_STATUSES = ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER"];

function normalizePhones(value?: string | null) {
  return String(value || "")
    .split(/[\s,;|]+/)
    .map((item) => item.replace(/\D/g, ""))
    .filter(Boolean);
}

function isStoredImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (!url) return false;
  if (url.startsWith("/uploads/customer-repair/")) return true;
  const publicBase = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  return Boolean(publicBase && url.startsWith(`${publicBase}/customer-repair/`));
}

export async function POST(request: NextRequest) {
  const session = await getCustomerSession(request);
  if (!session?.phone) {
    return NextResponse.json({ success: false, message: "Cần xác thực khách hàng." }, { status: 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const rawImages: unknown[] = Array.isArray(body.imageUrls) ? body.imageUrls : [];
    const imageUrls = Array.from(new Set(rawImages.filter(isStoredImageUrl).map((item) => item.trim()))).slice(0, MAX_IMAGES);

    if (!machineId) {
      return NextResponse.json({ success: false, message: "Chưa chọn máy cần sửa chữa." }, { status: 400 });
    }
    if (description.length < 5) {
      return NextResponse.json({ success: false, message: "Hãy mô tả tình trạng máy rõ hơn." }, { status: 400 });
    }
    if (description.length > 2000) {
      return NextResponse.json({ success: false, message: "Mô tả tối đa 2.000 ký tự." }, { status: 400 });
    }
    if (rawImages.length !== imageUrls.length) {
      return NextResponse.json({ success: false, message: "Có ảnh đính kèm không hợp lệ. Vui lòng tải ảnh lại." }, { status: 400 });
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: { customer: true },
    });
    if (!machine?.customer) {
      return NextResponse.json({ success: false, message: "Không tìm thấy máy đã đăng ký." }, { status: 404 });
    }

    const sessionPhone = session.phone.replace(/\D/g, "");
    const ownerPhone = machine.customer.phone.replace(/\D/g, "");
    const sharedPhones = normalizePhones(machine.sharedPhones);
    if (sessionPhone !== ownerPhone && !sharedPhones.includes(sessionPhone)) {
      return NextResponse.json({ success: false, message: "Bạn không có quyền gửi yêu cầu cho máy này." }, { status: 403 });
    }

    const existing = await prisma.supportTicket.findFirst({
      where: {
        machineId,
        source: "CUSTOMER_PORTAL",
        type: "REPAIR",
        status: { in: OPEN_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      include: { serviceOrder: true, messages: { orderBy: { createdAt: "asc" } } },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: `Máy đang có yêu cầu ${existing.ticketCode} được xử lý.`,
        data: existing,
      });
    }

    const [ticketCode, orderCode] = await Promise.all([
      createTicketCode(),
      createOrderCode(machine.provinceCode || "01"),
    ]);
    const subject = `Sửa chữa / bảo hành ${machine.serial || machine.id}`.slice(0, 240);

    const ticket = await prisma.$transaction(async (tx) => {
      const order = await tx.serviceOrder.create({
        data: {
          orderCode,
          machineId: machine.id,
          customerName: machine.customer!.name,
          customerPhone: machine.customer!.phone,
          address: machine.customer!.address,
          serviceType: `Sửa chữa: ${machine.serial || machine.id}`.slice(0, 240),
          status: "NEW",
        },
      });

      const created = await tx.supportTicket.create({
        data: {
          ticketCode,
          type: "REPAIR",
          source: "CUSTOMER_PORTAL",
          subject,
          description,
          status: "NEW",
          priority: "HIGH",
          customerId: machine.customer!.id,
          machineId: machine.id,
          serviceOrderId: order.id,
          contactName: machine.customer!.name,
          contactPhone: session.phone,
          messages: {
            create: [
              {
                authorName: machine.customer!.name,
                message: description,
                isInternal: false,
              },
              ...imageUrls.map((attachment, index) => ({
                authorName: machine.customer!.name,
                message: `Ảnh sự cố ${index + 1}`,
                attachment,
                isInternal: false,
              })),
            ],
          },
        },
        include: {
          serviceOrder: true,
          messages: { orderBy: { createdAt: "asc" } },
        },
      });

      await tx.customerActivity.create({
        data: {
          customerId: machine.customer!.id,
          type: "TICKET",
          summary: `Khách gửi yêu cầu ${ticketCode}: ${subject}`,
          detail: `Đã tạo lệnh điều phối ${orderCode}. ${description}`.slice(0, 2000),
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      message: `Đã ghi nhận yêu cầu ${ticket.ticketCode}. CSKH có thể điều phối ngay.`,
      data: ticket,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/customer-portal/repair-request failed", error);
    return NextResponse.json({ success: false, message: "Không tạo được yêu cầu sửa chữa." }, { status: 500 });
  }
}
