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
