import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { normalizePhone, isValidVietnamPhone } from "@/lib/phone";
import { databaseErrorMessage } from "@/lib/database-errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await hasRole(request, ["ADMIN", "CSKH"]);
    if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        machines: {
          include: {
            activations: { orderBy: { createdAt: "asc" } },
            maintenanceSchedules: { orderBy: { dueDate: "asc" } },
            serviceReports: { orderBy: { createdAt: "desc" } },
            serviceOrders: { orderBy: { createdAt: "desc" }, include: { dealer: true } },
          },
        },
        activities: { orderBy: { occurredAt: "desc" }, take: 200 },
        tickets: {
          orderBy: { createdAt: "desc" },
          include: { assignee: { select: { name: true } }, dealer: { select: { name: true } } },
        },
      },
    });
    if (!customer) return NextResponse.json({ success: false, message: "Không tìm thấy khách hàng." }, { status: 404 });
    return NextResponse.json({ success: true, data: customer });
  } catch (error) {
    console.error("GET /api/crm/customers/[id] failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không tải được hồ sơ khách hàng.") }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await hasRole(request, ["ADMIN", "CSKH"]);
    if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ success: false, message: "Tên khách hàng không được để trống." }, { status: 400 });
      data.name = name;
    }
    if (typeof body.phone === "string") {
      const phone = normalizePhone(body.phone);
      if (!isValidVietnamPhone(phone)) return NextResponse.json({ success: false, message: "Số điện thoại không hợp lệ." }, { status: 400 });
      const duplicate = await prisma.customer.findFirst({ where: { phone, id: { not: id } }, select: { id: true } });
      if (duplicate) return NextResponse.json({ success: false, message: "Số điện thoại đã thuộc khách hàng khác." }, { status: 409 });
      data.phone = phone;
    }
    if (typeof body.address === "string") data.address = body.address.trim() || null;
    if (typeof body.segment === "string") data.segment = body.segment;
    if (typeof body.tags === "string") data.tags = body.tags.trim() || null;
    if (Number.isInteger(body.satisfaction)) data.satisfaction = Math.min(5, Math.max(1, body.satisfaction));
    if ("ownerId" in body) data.ownerId = body.ownerId || null;
    if ("nextContactAt" in body) data.nextContactAt = body.nextContactAt ? new Date(body.nextContactAt) : null;

    const customer = await prisma.customer.update({ where: { id }, data });
    await writeAudit({ request, userId: auth.user.id, action: "UPDATE_CUSTOMER_CRM", target: customer.phone, detail: body });
    return NextResponse.json({ success: true, message: "Đã cập nhật hồ sơ khách hàng.", data: customer });
  } catch (error) {
    console.error("PUT /api/crm/customers/[id] failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không cập nhật được khách hàng.") }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await hasRole(request, ["ADMIN", "CSKH"]);
    if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const summary = String(body.summary || "").trim();
    if (!summary) return NextResponse.json({ success: false, message: "Cần nhập nội dung tương tác." }, { status: 400 });

    const activity = await prisma.$transaction(async (tx) => {
      const created = await tx.customerActivity.create({
        data: {
          customerId: id,
          type: String(body.type || "NOTE"),
          summary,
          detail: typeof body.detail === "string" ? body.detail.trim() || null : null,
          userId: auth.user.id,
          occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        },
      });
      await tx.customer.update({
        where: { id },
        data: {
          lastContactAt: ["CALL", "ZALO", "SMS", "VISIT"].includes(String(body.type)) ? new Date() : undefined,
          nextContactAt: body.nextContactAt ? new Date(body.nextContactAt) : undefined,
        },
      });
      return created;
    });

    await writeAudit({ request, userId: auth.user.id, action: "ADD_CUSTOMER_ACTIVITY", target: id, detail: { type: activity.type, summary } });
    return NextResponse.json({ success: true, message: "Đã lưu tương tác.", data: activity }, { status: 201 });
  } catch (error) {
    console.error("POST /api/crm/customers/[id] failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không lưu được tương tác.") }, { status: 500 });
  }
}
