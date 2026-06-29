import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildMaintenanceSchedules } from "@/lib/maintenance";
import { hasRole } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_SEED !== "true") {
    return NextResponse.json({ success: false, message: "Seed demo đã bị khóa." }, { status: 404 });
  }
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được tạo dữ liệu demo." }, { status: 403 });
  try {
    const customer = await prisma.customer.upsert({
      where: { phone: "0912345678" },
      create: {
        name: "Nguyễn Văn A",
        phone: "0912345678",
        address: "Số 1, phố X, Hà Nội",
      },
      update: {
        name: "Nguyễn Văn A",
        address: "Số 1, phố X, Hà Nội",
      },
    });

    const dealer = await prisma.dealer.upsert({
      where: { dealerCode: "HN-DL-26-0001" },
      create: {
        dealerCode: "HN-DL-26-0001",
        name: "Đại lý KOSOVOTA Hà Nội",
        phone: "0987654321",
        province: "Hà Nội",
        address: "Số 5, phố Y, Hà Nội",
        lat: 21.0278,
        lng: 105.8342,
        services: "Thay lõi số 1, Thay lõi 1,2,3, Sửa chữa",
        technicianCount: 3,
        status: "APPROVED",
      },
      update: {
        status: "APPROVED",
      },
    });

    const installDate = new Date();
    installDate.setMonth(installDate.getMonth() - 2);

    const machine = await prisma.machine.upsert({
      where: { id: "KSV-RO-01-260001" },
      create: {
        id: "KSV-RO-01-260001",
        model: "RO_GIA_DINH",
        serial: "KSV-RO-260001",
        provinceCode: "01",
        status: "ACTIVE",
        manufactureDate: new Date("2026-01-01"),
        installDate,
        customerId: customer.id,
        lat: 21.0285,
        lng: 105.8355,
        buildingPhoto: "/demo/building.jpg",
        machinePhoto: "/demo/machine.jpg",
      },
      update: {
        status: "ACTIVE",
        installDate,
        customerId: customer.id,
        lat: 21.0285,
        lng: 105.8355,
      },
    });

    await prisma.activation.upsert({
  where: {
    machineId_step: {
      machineId: machine.id,
      step: 1,
    },
  },
  create: {
    machineId: machine.id,
    step: 1,
    ownerName: customer.name,
    ownerPhone: customer.phone,
    note: "Kích hoạt bước 1 demo",
  },
  update: {
    ownerName: customer.name,
    ownerPhone: customer.phone,
    note: "Kích hoạt bước 1 demo",
  },
});

await prisma.activation.upsert({
  where: {
    machineId_step: {
      machineId: machine.id,
      step: 2,
    },
  },
  create: {
    machineId: machine.id,
    step: 2,
    dealerCode: dealer.dealerCode,
    installerName: "Trần Văn Thợ",
    installerPhone: "0909999999",
    bankAccount: "123456789",
    bankOwner: "NGUYEN VAN A",
    bankName: "Vietcombank",
  },
  update: {
    dealerCode: dealer.dealerCode,
    installerName: "Trần Văn Thợ",
    installerPhone: "0909999999",
    bankAccount: "123456789",
    bankOwner: "NGUYEN VAN A",
    bankName: "Vietcombank",
  },
});

    await prisma.maintenanceSchedule.deleteMany({
      where: { machineId: machine.id },
    });

    await prisma.maintenanceSchedule.createMany({
      data: buildMaintenanceSchedules(machine.id, installDate, machine.model),
    });

    return NextResponse.json({
      success: true,
      message: "Đã tạo dữ liệu demo: khách hàng, máy, đại lý, lịch bảo trì.",
      data: {
        customer,
        dealer,
        machine,
      },
    });
  } catch (error) {
    console.error("POST /api/dev/seed-demo failed", error);

    return NextResponse.json(
      {
        success: false,
        message: "Không tạo được dữ liệu demo",
      },
      { status: 500 },
    );
  }
}