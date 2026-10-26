import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { normalizePhone } from "@/lib/phone";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["SALES_MANAGER"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 403 });
  try {
    const { id } = await params;
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action.toUpperCase() : "";
    const dealer = await prisma.dealer.findUnique({ where: { id } });
    if (!dealer) return NextResponse.json({ success: false, message: "Không tìm thấy hồ sơ đối tác." }, { status: 404 });

    if (action === "SUSPEND") {
      await prisma.dealer.update({ where: { id }, data: { status: "SUSPENDED" } });
      await prisma.user.updateMany({ where: { dealerCode: dealer.dealerCode, role: { in: ["DEALER", "CTV", "KTV"] } }, data: { active: false } });
      await writeAudit({ request, userId: auth.user.id, action: "SUSPEND_PARTNER", target: dealer.dealerCode });
      return NextResponse.json({ success: true, message: "Đã tạm khóa đối tác và tài khoản liên quan." });
    }

    if (action !== "APPROVE") return NextResponse.json({ success: false, message: "Thao tác không hợp lệ." }, { status: 400 });
    const phone = normalizePhone(dealer.phone);
    const existing = await prisma.user.findUnique({ where: { phone } });
    let initialPassword: string | null = null;
    await prisma.dealer.update({ where: { id }, data: { status: "APPROVED" } });
    if (!existing) {
      initialPassword = `Ksv@${randomBytes(4).toString("hex")}`;
      const user = await prisma.user.create({ data: { phone, email: dealer.email || null, name: dealer.representativeName || dealer.name, password: hashPassword(initialPassword), role: "DEALER", dealerCode: dealer.dealerCode, active: true } });
      await prisma.adminLog.create({ data: { userId: user.id, action: "FORCE_PASSWORD_CHANGE", target: user.id, detail: "PARTNER_APPROVED" } });
    } else if (existing.role === "DEALER" && existing.dealerCode === dealer.dealerCode) {
      await prisma.user.update({ where: { id: existing.id }, data: { active: true } });
    }
    await writeAudit({ request, userId: auth.user.id, action: "APPROVE_PARTNER", target: dealer.dealerCode, detail: { accountCreated: !existing } });
    return NextResponse.json({ success: true, message: initialPassword ? "Đã duyệt và tạo tài khoản Đại lý." : "Đã duyệt đối tác.", initialPassword });
  } catch (error) {
    console.error("partner approval failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được đối tác." }, { status: 500 });
  }
}
