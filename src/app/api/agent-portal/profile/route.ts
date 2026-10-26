import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["DEALER", "CTV"]);
  if (!auth?.user.dealerCode) return NextResponse.json({ success: false, message: "Tài khoản chưa liên kết đại lý." }, { status: 403 });
  const dealer = await prisma.dealer.findUnique({ where: { dealerCode: auth.user.dealerCode } });
  if (!dealer) return NextResponse.json({ success: false, message: "Không tìm thấy hồ sơ đại lý." }, { status: 404 });
  return NextResponse.json({ success: true, data: dealer });
}

export async function PATCH(request: NextRequest) {
  const auth = await hasRole(request, ["DEALER", "CTV"]);
  if (!auth?.user.dealerCode) return NextResponse.json({ success: false, message: "Tài khoản chưa liên kết đại lý." }, { status: 403 });
  try {
    const body = await request.json();
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const services = typeof body.services === "string" ? body.services.trim() : "";
    const lat = body.lat == null || body.lat === "" ? null : Number(body.lat);
    const lng = body.lng == null || body.lng === "" ? null : Number(body.lng);
    if (!address) return NextResponse.json({ success: false, message: "Địa chỉ cửa hàng không được để trống." }, { status: 400 });
    if ((lat != null && !Number.isFinite(lat)) || (lng != null && !Number.isFinite(lng))) return NextResponse.json({ success: false, message: "Tọa độ GPS không hợp lệ." }, { status: 400 });
    const dealer = await prisma.dealer.update({ where: { dealerCode: auth.user.dealerCode }, data: { address, services: services || null, lat, lng } });
    await writeAudit({ request, userId: auth.user.id, action: "UPDATE_DEALER_PROFILE", target: dealer.id, detail: { address, services, lat, lng } });
    return NextResponse.json({ success: true, message: "Đã cập nhật hồ sơ đại lý.", data: dealer });
  } catch (error) {
    console.error("dealer profile update failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được hồ sơ đại lý." }, { status: 500 });
  }
}
