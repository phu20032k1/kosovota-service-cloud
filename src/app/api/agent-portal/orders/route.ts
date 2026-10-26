import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { protectServiceOrderCustomerData } from "@/lib/service-order-privacy";

function distanceKm(lat1?: number | null, lng1?: number | null, lat2?: number | null, lng2?: number | null) {
  if ([lat1, lng1, lat2, lng2].some((value) => typeof value !== "number")) return null;
  const toRad = (value: number) => value * Math.PI / 180;
  const earth = 6371;
  const dLat = toRad((lat2 as number) - (lat1 as number));
  const dLng = toRad((lng2 as number) - (lng1 as number));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1 as number)) * Math.cos(toRad(lat2 as number)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function areaLabel(address?: string | null, provinceCode?: string | null) {
  if (address) {
    const parts = address.split(",").map((item) => item.trim()).filter(Boolean);
    if (parts.length >= 2) return parts.slice(-2).join(", ");
    if (parts.length) return parts[0];
  }
  return provinceCode || "Chưa xác định khu vực";
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["DEALER", "CTV", "KTV"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const dealerCode = auth.user.dealerCode;
    if (!dealerCode) return NextResponse.json({ success: false, message: "Tài khoản chưa liên kết đại lý." }, { status: 403 });
    const dealer = await prisma.dealer.findUnique({ where: { dealerCode } });
    if (!dealer) return NextResponse.json({ success: false, message: "Không tìm thấy hồ sơ đại lý." }, { status: 404 });

    const orders = await prisma.serviceOrder.findMany({
      where: auth.user.role === "KTV" ? { technicianId: auth.user.id } : { dealerId: dealer.id },
      include: {
        machine: { include: { customer: true } },
        reports: true,
        technician: { select: { id: true, name: true, phone: true, active: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 150,
    });

    const completed = orders.filter((order) => order.status === "COMPLETED");
    const revenue = ["DEALER", "CTV"].includes(auth.user.role) ? completed.reduce((sum, order) => sum + (order.serviceFee || 0), 0) : 0;
    const paid = ["DEALER", "CTV"].includes(auth.user.role) ? completed.filter((order) => order.paymentStatus === "PAID").reduce((sum, order) => sum + (order.serviceFee || 0), 0) : 0;
    const protectedOrders = orders.map((order) => {
      const area = areaLabel(order.address, order.machine.provinceCode);
      const distance = distanceKm(dealer.lat, dealer.lng, order.machine.lat, order.machine.lng);
      return { ...protectServiceOrderCustomerData(order, auth.user.role), area, distanceKm: distance };
    });

    return NextResponse.json({ success: true, dealer, data: protectedOrders, summary: { revenue, paid, pending: revenue - paid }, scope: auth.user.role });
  } catch (error) {
    console.error("agent orders failed", error);
    return NextResponse.json({ success: false, message: "Không tải được lệnh dịch vụ." }, { status: 500 });
  }
}
