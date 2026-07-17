import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id }, include: {
    owner: { select: { id: true, name: true } },
    machines: { include: { activations: { orderBy: { createdAt: "asc" } }, maintenanceSchedules: { orderBy: { dueDate: "asc" } }, serviceReports: { orderBy: { createdAt: "desc" } }, serviceOrders: { orderBy: { createdAt: "desc" }, include: { dealer: true } } } },
    activities: { orderBy: { occurredAt: "desc" }, take: 200 },
    tickets: { orderBy: { createdAt: "desc" }, include: { assignee: { select: { name: true } }, dealer: { select: { name: true } } } },
  } });
  if (!customer) return NextResponse.json({ success: false, message: "Không tìm thấy khách hàng." }, { status: 404 });
  return NextResponse.json({ success: true, data: customer });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const customer = await prisma.customer.update({ where: { id }, data: {
    ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
    ...(typeof body.address === "string" ? { address: body.address.trim() || null } : {}),
    ...(typeof body.segment === "string" ? { segment: body.segment } : {}),
    ...(typeof body.tags === "string" ? { tags: body.tags.trim() || null } : {}),
    ...(Number.isInteger(body.satisfaction) ? { satisfaction: Math.min(5, Math.max(1, body.satisfaction)) } : {}),
    ...("ownerId" in body ? { ownerId: body.ownerId || null } : {}),
    ...(body.nextContactAt ? { nextContactAt: new Date(body.nextContactAt) } : {}),
  } });
  await writeAudit({ request, userId: auth.user.id, action: "UPDATE_CUSTOMER_CRM", target: customer.phone, detail: body });
  return NextResponse.json({ success: true, message: "Đã cập nhật hồ sơ khách hàng.", data: customer });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const summary = String(body.summary || "").trim();
  if (!summary) return NextResponse.json({ success: false, message: "Cần nhập nội dung tương tác." }, { status: 400 });
  const activity = await prisma.$transaction(async (tx) => {
    const created = await tx.customerActivity.create({ data: {
      customerId: id, type: String(body.type || "NOTE"), summary,
      detail: typeof body.detail === "string" ? body.detail.trim() || null : null,
      userId: auth.user.id, occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
    } });
    await tx.customer.update({ where: { id }, data: {
      lastContactAt: ["CALL", "ZALO", "SMS", "VISIT"].includes(String(body.type)) ? new Date() : undefined,
      nextContactAt: body.nextContactAt ? new Date(body.nextContactAt) : undefined,
    } });
    return created;
  });
  await writeAudit({ request, userId: auth.user.id, action: "ADD_CUSTOMER_ACTIVITY", target: id, detail: { type: activity.type, summary } });
  return NextResponse.json({ success: true, message: "Đã lưu tương tác.", data: activity }, { status: 201 });
}
