import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { geocodeAddress } from "@/lib/maps/geocode";
import { normalizePhone, isValidVietnamPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { deliverNotification } from "@/lib/notifications/providers";

function parseTestTemplateData() {
  const fallback = {
    otp: "123456",
    code: "123456",
    expire_time: "5 phút",
    message: "KOSOVOTA kiểm tra kết nối Zalo thành công.",
  };
  const raw = process.env.ZALO_ZBS_TEST_TEMPLATE_DATA;
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    throw new Error("ZALO_ZBS_TEST_TEMPLATE_DATA không phải JSON hợp lệ.");
  }
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được kiểm thử tích hợp." }, { status: 403 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const kind = typeof body.kind === "string" ? body.kind.toLowerCase() : "";

  try {
    if (kind === "map") {
      const address = typeof body.address === "string" ? body.address.trim() : "";
      if (!address) return NextResponse.json({ success: false, message: "Hãy nhập địa chỉ cần thử." }, { status: 400 });
      const result = await geocodeAddress(address);
      if (!result) return NextResponse.json({ success: false, message: "Nhà cung cấp không tìm thấy địa chỉ này." }, { status: 404 });
      return NextResponse.json({ success: true, message: `Map/Geocoding hoạt động qua ${result.provider}.`, data: result });
    }

    if (kind !== "sms" && kind !== "zalo" && kind !== "email") {
      return NextResponse.json({ success: false, message: "Loại kiểm thử không hợp lệ." }, { status: 400 });
    }

    const channel = kind === "sms" ? "SMS" : kind === "zalo" ? "ZALO" : "EMAIL";
    const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (channel === "EMAIL") {
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ success: false, message: "Email test không hợp lệ." }, { status: 400 });
    } else if (!isValidVietnamPhone(phone)) {
      return NextResponse.json({ success: false, message: "Số điện thoại Việt Nam không hợp lệ." }, { status: 400 });
    }

    const content = kind === "sms"
      ? "KOSOVOTA: Tin nhan kiem tra ket noi he thong. Vui long bo qua tin nay."
      : kind === "zalo"
        ? "KOSOVOTA kiểm tra kết nối Zalo."
        : "Xin chào,\nĐây là email kiểm thử từ hệ thống thông báo KOSO VOTA.";
    const payload = kind === "zalo"
      ? JSON.stringify({
          templateId: process.env.ZALO_ZBS_OTP_TEMPLATE_ID || process.env.ZALO_ZBS_TEMPLATE_ID,
          templateData: parseTestTemplateData(),
        })
      : null;

    const notification = await prisma.notification.create({
      data: { phone: channel === "EMAIL" ? null : phone, email: channel === "EMAIL" ? email : null, channel, kind: "INTEGRATION_TEST", subject: channel === "EMAIL" ? "KOSO VOTA - Test Gmail" : null, content, payload, status: "PROCESSING", attempts: 1 },
    });

    try {
      const result = await deliverNotification(notification);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "SENT", providerMessageId: result.providerMessageId, sentAt: new Date(), error: null },
      });
      const dryRun = process.env.NOTIFICATION_DRY_RUN !== "false";
      return NextResponse.json({
        success: true,
        message: dryRun
          ? `${channel} đang DRY RUN: cấu hình ứng dụng chạy được nhưng chưa gửi ra nhà cung cấp.`
          : `${channel} đã được nhà cung cấp chấp nhận. Kiểm tra điện thoại/email và lịch sử thông báo.`,
        data: { channel, dryRun, providerMessageId: result.providerMessageId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nhà cung cấp từ chối yêu cầu.";
      await prisma.notification.update({ where: { id: notification.id }, data: { status: "FAILED", error: message.slice(0, 1000) } });
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Không kiểm thử được tích hợp." }, { status: 502 });
  }
}
