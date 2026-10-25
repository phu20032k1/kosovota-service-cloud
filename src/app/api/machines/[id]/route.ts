import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { cskhScopeAllows } from "@/lib/province-access";

type Params = { params: Promise<{ id: string }> };

const ACTIVE_FIELD_STATUSES = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "CUSTOMER_ACCEPTED", "RESCHEDULED", "COMPLAINT"];

function validVietnamLocation(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 7.5 && lat <= 24.5 && lng >= 101 && lng <= 111.5;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN", "CSKH"]);
    if (!auth) {
      const machine = await prisma.machine.findUnique({
        where: { id },
        select: { id: true, model: true, name: true, capacity: true, warrantyMonths: true, serial: true, status: true, manufactureDate: true, installDate: true, lat: true, lng: true },
      });
      if (!machine) return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });
      return NextResponse.json({ success: true, data: machine, limited: true });
    }
    const machine = await prisma.machine.findUnique({
      where: { id },
      include: {
        customer: true,
        activations: { orderBy: { step: "asc" } },
        serviceOrders: { orderBy: { createdAt: "desc" } },
        serviceReports: { orderBy: { createdAt: "desc" } },
        maintenanceSchedules: { orderBy: { dueDate: "asc" } },
      },
    });
    if (!machine) return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });
    if (auth.user.role === "CSKH" && !cskhScopeAllows(
      auth.user,
      { provinceValue: machine.provinceCode, address: machine.customer?.address, customerId: machine.customerId },
    )) {
      return NextResponse.json({ success: false, message: "Máy nằm ngoài phạm vi được phân công." }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: machine });
  } catch (error) {
    console.error("GET machine failed", error);
    return NextResponse.json({ success: false, message: "Không tải được thông tin máy." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN", "CSKH", "DEALER", "CTV", "KTV"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền chỉnh vị trí máy." }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!validVietnamLocation(lat, lng)) {
      return NextResponse.json({ success: false, message: "Tọa độ không hợp lệ hoặc nằm ngoài phạm vi Việt Nam." }, { status: 400 });
    }

    const existing = await prisma.machine.findUnique({
      where: { id },
      select: {
        id: true,
        lat: true,
        lng: true,
        provinceCode: true,
        customerId: true,
        customer: { select: { address: true } },
        serviceOrders: {
          where: { status: { in: ACTIVE_FIELD_STATUSES } },
          select: {
            technicianId: true,
            dealer: { select: { dealerCode: true } },
          },
        },
      },
    });
    if (!existing) return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });

    if (auth.user.role === "CSKH" && !cskhScopeAllows(
      auth.user,
      { provinceValue: existing.provinceCode, address: existing.customer?.address, customerId: existing.customerId },
    )) {
      return NextResponse.json({ success: false, message: "Máy nằm ngoài phạm vi CSKH được phân công." }, { status: 403 });
    }

    if (["DEALER", "CTV"].includes(auth.user.role)) {
      const allowed = Boolean(auth.user.dealerCode) && existing.serviceOrders.some(
        (order) => order.dealer?.dealerCode === auth.user.dealerCode,
      );
      if (!allowed) {
        return NextResponse.json({ success: false, message: "Chỉ đại lý/CTV đang được giao lệnh của máy này mới được ghim lại vị trí." }, { status: 403 });
      }
    }

    if (auth.user.role === "KTV") {
      const allowed = existing.serviceOrders.some((order) => order.technicianId === auth.user.id);
      if (!allowed) {
        return NextResponse.json({ success: false, message: "Chỉ KTV đang được giao lệnh của máy này mới được ghim lại vị trí." }, { status: 403 });
      }
    }

    const machine = await prisma.machine.update({ where: { id }, data: { lat, lng } });
    await prisma.adminLog.create({
      data: {
        userId: auth.user.id,
        action: "UPDATE_MACHINE_LOCATION",
        target: id,
        detail: JSON.stringify({
          role: auth.user.role,
          dealerCode: auth.user.dealerCode || null,
          source: typeof body.source === "string" ? body.source : "MAP_PIN",
          from: { lat: existing.lat, lng: existing.lng },
          to: { lat, lng },
        }),
      },
    });

    return NextResponse.json({ success: true, message: "Đã cập nhật vị trí máy.", data: machine });
  } catch (error) {
    console.error("PATCH machine location failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được vị trí máy." }, { status: 500 });
  }
}
