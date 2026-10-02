import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidVietnamPhone, normalizePhone } from "@/lib/phone";
import { hasRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request, { namespace: "sales-lead", limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json({ success: false, message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  try {
    const body = await request.json();
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const phone = normalizePhone(body.phone);

    if (!fullName || !isValidVietnamPhone(phone)) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập họ tên và số điện thoại hợp lệ." },
        { status: 400 },
      );
    }

    const lead = await prisma.salesLead.create({
      data: {
        productSlug: typeof body.productSlug === "string" ? body.productSlug : null,
        fullName,
        phone,
        province: typeof body.province === "string" ? body.province.trim() || null : null,
        note: typeof body.note === "string" ? body.note.trim() || null : null,
      },
    });

    await prisma.notification.create({
      data: {
        phone,
        channel: "SMS",
        kind: "SALES_LEAD",
        content: "KOSOVOTA đã nhận yêu cầu tư vấn sản phẩm. Nhân viên phụ trách sẽ liên hệ trong giờ làm việc.",
        status: "PENDING",
      },
    });

    return NextResponse.json(
      { success: true, message: "Đã gửi yêu cầu tư vấn.", data: lead },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/leads failed", error);
    return NextResponse.json({ success: false, message: "Không gửi được yêu cầu tư vấn." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) {
    return NextResponse.json({ success: false, message: "Không có quyền truy cập." }, { status: 403 });
  }

  const leads = await prisma.salesLead.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ success: true, data: leads });
}


function leadIdsFromBody(body: Record<string, unknown>) {
  const raw = Array.isArray(body.leadIds)
    ? body.leadIds
    : Array.isArray(body.ids)
      ? body.ids
      : typeof body.leadId === "string"
        ? [body.leadId]
        : typeof body.id === "string"
          ? [body.id]
          : [];
  return Array.from(new Set(raw.map((value) => String(value || "").trim()).filter(Boolean))).slice(0, 500);
}

export async function DELETE(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xóa yêu cầu tư vấn." }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const ids = leadIdsFromBody(body);
    if (!ids.length) return NextResponse.json({ success: false, message: "Chưa chọn yêu cầu tư vấn cần xóa." }, { status: 400 });

    const existing = await prisma.salesLead.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, phone: true },
    });
    if (!existing.length) return NextResponse.json({ success: false, message: "Không tìm thấy yêu cầu tư vấn cần xóa." }, { status: 404 });

    const result = await prisma.salesLead.deleteMany({ where: { id: { in: existing.map((item) => item.id) } } });
    await prisma.adminLog.createMany({
      data: existing.map((item) => ({
        userId: auth.user.id,
        action: "DELETE_SALES_LEAD",
        target: item.id,
        detail: `${item.fullName} · ${item.phone}`,
      })),
    });

    return NextResponse.json({
      success: true,
      data: { deleted: result.count },
      message: result.count === 1 ? "Đã xóa yêu cầu tư vấn." : `Đã xóa ${result.count} yêu cầu tư vấn.`,
    });
  } catch (error) {
    console.error("DELETE /api/leads failed", error);
    return NextResponse.json({ success: false, message: "Không xóa được yêu cầu tư vấn." }, { status: 500 });
  }
}
