import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { buildMaintenanceSchedules } from "../src/lib/maintenance";

const prisma = new PrismaClient();

async function main() {
  const adminPhone = process.env.TEST_ADMIN_PHONE || "0999000001";
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || "Admin@123456";
  const dealerPhone = process.env.TEST_DEALER_PHONE || "0999000002";
  const dealerPassword = process.env.TEST_DEALER_PASSWORD || "Dealer@123456";
  const ktvPhone = process.env.TEST_KTV_PHONE || "0999000003";
  const ktvPassword = process.env.TEST_KTV_PASSWORD || "Ktv@123456";
  const dealerCode = "TEST-HN-DL-26-0001";
  const machineId = "TEST-MAY-0001";
  const installDate = new Date();

  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { password: hashPassword(adminPassword), name: "Admin Test", role: "ADMIN", active: true },
    create: { phone: adminPhone, password: hashPassword(adminPassword), name: "Admin Test", role: "ADMIN", active: true },
  });

  await prisma.dealer.upsert({
    where: { dealerCode },
    update: { status: "APPROVED", name: "Đại lý Test Hà Nội", representativeName: "Nguyễn Đại Lý Test", phone: dealerPhone, province: "Hà Nội", address: "Hồ Gươm, Hà Nội", lat: 21.0278, lng: 105.8342, services: "Lắp đặt, bảo trì", technicianCount: 2 },
    create: { dealerCode, status: "APPROVED", name: "Đại lý Test Hà Nội", representativeName: "Nguyễn Đại Lý Test", phone: dealerPhone, province: "Hà Nội", address: "Hồ Gươm, Hà Nội", lat: 21.0278, lng: 105.8342, services: "Lắp đặt, bảo trì", technicianCount: 2 },
  });

  await prisma.user.upsert({
    where: { phone: dealerPhone },
    update: { password: hashPassword(dealerPassword), name: "Nguyễn Đại Lý Test", role: "DEALER", dealerCode, active: true },
    create: { phone: dealerPhone, password: hashPassword(dealerPassword), name: "Nguyễn Đại Lý Test", role: "DEALER", dealerCode, active: true },
  });

  await prisma.user.upsert({
    where: { phone: ktvPhone },
    update: { password: hashPassword(ktvPassword), name: "KTV Test", role: "KTV", dealerCode, active: true },
    create: { phone: ktvPhone, password: hashPassword(ktvPassword), name: "KTV Test", role: "KTV", dealerCode, active: true },
  });

  const customer = await prisma.customer.upsert({
    where: { phone: "0999000004" },
    update: { name: "Khách hàng Test", address: "Hoàn Kiếm, Hà Nội" },
    create: { phone: "0999000004", name: "Khách hàng Test", address: "Hoàn Kiếm, Hà Nội" },
  });

  await prisma.machine.upsert({
    where: { id: machineId },
    update: { model: "TEST-KSV-100", name: "Máy lọc nước Test", capacity: "100L/H", warrantyMonths: 12, serial: "TEST-SERI-0001", manufactureDate: new Date(2026, 0, 1), provinceCode: "HN", status: "ACTIVE", installDate, customerId: customer.id, lat: 21.0278, lng: 105.8342, specification: "Tên máy: Máy lọc nước Test\nMã số: TEST-KSV-100\nCông suất: 100L/H\nBảo hành: 12 tháng\nNăm sản xuất: 2026" },
    create: { id: machineId, model: "TEST-KSV-100", name: "Máy lọc nước Test", capacity: "100L/H", warrantyMonths: 12, serial: "TEST-SERI-0001", manufactureDate: new Date(2026, 0, 1), provinceCode: "HN", status: "ACTIVE", installDate, customerId: customer.id, lat: 21.0278, lng: 105.8342, specification: "Tên máy: Máy lọc nước Test\nMã số: TEST-KSV-100\nCông suất: 100L/H\nBảo hành: 12 tháng\nNăm sản xuất: 2026" },
  });

  const scheduleCount = await prisma.maintenanceSchedule.count({ where: { machineId } });
  if (!scheduleCount) {
    await prisma.maintenanceSchedule.createMany({ data: buildMaintenanceSchedules(machineId, installDate, "TEST-KSV-100") });
  }

  console.log("Đã thêm dữ liệu test an toàn, không xóa dữ liệu cũ.");
  console.log(`Admin: ${adminPhone} / ${adminPassword}`);
  console.log(`Đại lý: ${dealerPhone} / ${dealerPassword}`);
  console.log(`KTV: ${ktvPhone} / ${ktvPassword}`);
  console.log(`QR test: /qr/${machineId}`);
}

main().finally(async () => prisma.$disconnect());
