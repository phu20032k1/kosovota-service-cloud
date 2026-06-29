import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_COOKIE } from "@/lib/auth";
import { verifySessionToken } from "@/lib/session-token";

async function customerPhone(request: NextRequest) {
  const token = request.cookies.get(CUSTOMER_COOKIE)?.value;
  const session = await verifySessionToken(token);
  return session?.purpose === "CUSTOMER_LOGIN" ? session.phone : null;
}

export async function GET(request: NextRequest) {
  try {
    const phone = await customerPhone(request);
    if (!phone) {
      return NextResponse.json({ success: false, message: "Cần xác thực OTP." }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({ where: { phone } });
    const machines = await prisma.machine.findMany({
      where: {
        OR: [
          { customer: { phone } },
          { sharedPhones: { contains: phone } },
        ],
      },
      include: {
        customer: true,
        maintenanceSchedules: { orderBy: { dueDate: "asc" } },
        serviceReports: { orderBy: { createdAt: "desc" } },
        sosTickets: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { installDate: "desc" },
    });

    const profile = customer || {
      id: phone,
      name: "Người được chia sẻ máy",
      phone,
      address: null,
      notifyChannels: "Zalo",
      callFrom: "09:00",
      callTo: "11:00",
    };

    return NextResponse.json({ success: true, customer: profile, machines });
  } catch (error) {
    console.error("GET /api/customer-portal failed", error);
    return NextResponse.json({ success: false, message: "Không tải được cổng khách hàng." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const phone = await customerPhone(request);
    if (!phone) {
      return NextResponse.json({ success: false, message: "Cần xác thực OTP." }, { status: 401 });
    }

    const body = await request.json();
    const customer = await prisma.customer.findUnique({ where: { phone } });
    if (!customer) {
      return NextResponse.json({ success: false, message: "Tài khoản được chia sẻ không thể đổi cài đặt của chủ máy." }, { status: 403 });
    }

    const channels = Array.isArray(body.notifyChannels)
      ? body.notifyChannels.filter((item: unknown) => ["Zalo", "SMS", "Email"].includes(String(item)))
      : [];

    const updated = await prisma.customer.update({
      where: { phone },
      data: {
        notifyChannels: channels.join(","),
        callFrom: typeof body.callFrom === "string" ? body.callFrom : undefined,
        callTo: typeof body.callTo === "string" ? body.callTo : undefined,
      },
    });

    return NextResponse.json({ success: true, customer: updated, message: "Đã lưu cài đặt thông báo." });
  } catch (error) {
    console.error("PATCH /api/customer-portal failed", error);
    return NextResponse.json({ success: false, message: "Không lưu được cài đặt." }, { status: 500 });
  }
}
