import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { provinceScopeAllows } from "@/lib/province-access";

type Params = { params: Promise<{ id: string }> };

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
        select: { id: true, model: true, name: true, capacity: true, warrantyMonths: true, serial: true, status: true, manufactureDate: true, installDate: true },
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
    if (auth.user.role === "CSKH" && !provinceScopeAllows(
      auth.user.provinceScope,
      machine.provinceCode,
      machine.customer?.address,
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
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được chỉnh vị trí máy." }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!validVietnamLocation(lat, lng)) {
      return NextResponse.json({ success: false, message: "Tọa độ không hợp lệ hoặc nằm ngoài phạm vi Việt Nam." }, { status: 400 });
    }

    const existing = await prisma.machine.findUnique({ where: { id }, select: { id: true, lat: true, lng: true } });
    if (!existing) return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });

    const machine = await prisma.machine.update({ where: { id }, data: { lat, lng } });
    await prisma.adminLog.create({
      data: {
        userId: auth.user.id,
        action: "UPDATE_MACHINE_LOCATION",
        target: id,
        detail: JSON.stringify({ from: { lat: existing.lat, lng: existing.lng }, to: { lat, lng } }),
      },
    });

    return NextResponse.json({ success: true, message: "Đã cập nhật vị trí máy.", data: machine });
  } catch (error) {
    console.error("PATCH machine location failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được vị trí máy." }, { status: 500 });
  }
}
