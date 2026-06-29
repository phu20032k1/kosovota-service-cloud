import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { buildMaintenanceSchedules } from "../src/lib/maintenance";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.ticketMessage.deleteMany(), prisma.supportTicket.deleteMany(), prisma.customerActivity.deleteMany(),
    prisma.paymentLine.deleteMany(), prisma.paymentBatch.deleteMany(),
    prisma.stockMovement.deleteMany(), prisma.stockBalance.deleteMany(), prisma.warehouse.deleteMany(), prisma.inventoryItem.deleteMany(),
    prisma.serviceReport.deleteMany(), prisma.serviceOrder.deleteMany(), prisma.sosTicket.deleteMany(),
    prisma.activation.deleteMany(), prisma.maintenanceSchedule.deleteMany(), prisma.machine.deleteMany(),
    prisma.customer.deleteMany(), prisma.dealer.deleteMany(), prisma.notification.deleteMany(),
    prisma.otpCode.deleteMany(), prisma.salesLead.deleteMany(), prisma.idSequence.deleteMany(),
    prisma.adminLog.deleteMany(), prisma.user.deleteMany(),
  ]);

  const adminPassword = hashPassword("Kosovota@2026");
  const staffPassword = hashPassword("Kosovota@2026");
  const dealerPassword = hashPassword("Kosovota@2026");
  const superPassword = hashPassword(process.env.SEED_SUPER_ADMIN_PASSWORD || "Super@Kosovota2026");

  await prisma.user.createMany({ data: [
    { id: "usr_super_admin", phone: process.env.SEED_SUPER_ADMIN_PHONE || "0900000000", password: superPassword, name: "SUPER ADMIN KOSOVOTA", role: "SUPER_ADMIN", active: true },
    { id: "usr_admin", phone: "0900000001", password: adminPassword, name: "Quản trị KOSOVOTA", role: "ADMIN", active: true },
    { id: "usr_cskh", phone: "0900000002", password: staffPassword, name: "CSKH Hà Nội", role: "CSKH", provinceScope: "01", active: true },
    { id: "usr_dealer", phone: "0900000003", password: dealerPassword, name: "Trung tâm dịch vụ Hà Nội", role: "DEALER", dealerCode: "HN-DL-26-0001", active: true },
    { id: "usr_ktv", phone: "0900000004", password: dealerPassword, name: "KTV Hà Nội", role: "KTV", dealerCode: "HN-DL-26-0001", active: true },
  ] });

  const dealer = await prisma.dealer.create({ data: {
    id: "dealer_hn_001", dealerCode: "HN-DL-26-0001", name: "Trung tâm Dịch vụ KOSOVOTA Hà Nội",
    phone: "0900000003", province: "Hà Nội", address: "Hà Nội", lat: 21.0285, lng: 105.8542,
    services: "Lắp đặt máy RO gia đình, Sửa chữa máy RO, Bảo trì BCN, Hệ thống lọc công nghiệp",
    technicianCount: 4, representativeName: "Phụ trách kỹ thuật Hà Nội", registrationType: "DEALER_SERVICE",
    locationType: "Cửa hàng", status: "APPROVED", rating: 5,
  } });

  const customer = await prisma.customer.create({ data: {
    id: "customer_internal", name: "Điểm trải nghiệm KOSOVOTA", phone: "0900000010",
    address: "Hà Nội", notifyChannels: "Zalo,SMS", callFrom: "09:00", callTo: "17:00",
    segment: "VIP", satisfaction: 5, ownerId: "usr_cskh", lastContactAt: new Date("2026-06-15"), nextContactAt: new Date("2026-06-22"),
  } });

  const products = [
    { id: "KSV-RO-01-260001", model: "RO_UNDER_30", serial: "KSV-RO-260001", lat: 21.0278, lng: 105.8342, status: "ACTIVE", customerId: customer.id, installDate: new Date("2026-03-01") },
    { id: "KSV-BCN-01-260001", model: "BCN_HOT_COLD", serial: "KSV-BCN-260001", lat: 21.0410, lng: 105.8260, status: "NEW", customerId: null, installDate: null },
    { id: "KSV-BCN-01-260002", model: "BCN_COLUMN", serial: "KSV-BCNC-260002", lat: 21.0150, lng: 105.8700, status: "NEW", customerId: null, installDate: null },
    { id: "KSV-CN-01-260001", model: "INDUSTRIAL", serial: "KSV-CN-260001", lat: 20.9950, lng: 105.8100, status: "NEW", customerId: null, installDate: null },
  ];

  for (const item of products) {
    await prisma.machine.create({ data: {
      id: item.id, model: item.model, serial: item.serial, provinceCode: "01", status: item.status,
      manufactureDate: new Date("2026-01-15"), installDate: item.installDate,
      customerId: item.customerId, lat: item.lat, lng: item.lng,
    } });
  }

  await prisma.activation.createMany({ data: [
    { id: "activation_step_1", machineId: products[0].id, step: 1, ownerName: customer.name, ownerPhone: customer.phone, note: "Kích hoạt tại điểm trải nghiệm" },
    { id: "activation_step_2", machineId: products[0].id, step: 2, dealerCode: dealer.dealerCode, installerName: "Đội kỹ thuật KOSOVOTA", installerPhone: dealer.phone, bankAccount: "0000000000", bankOwner: "KOSOVOTA", bankName: "Ngân hàng đối tác" },
  ] });

  const schedules = buildMaintenanceSchedules(products[0].id, products[0].installDate!, products[0].model);
  await prisma.maintenanceSchedule.createMany({ data: schedules.map((item, index) => ({ ...item, id: `schedule_${index + 1}` })) });
  const firstDue = await prisma.maintenanceSchedule.findFirst({ where: { machineId: products[0].id, title: "Thay lõi số 1" }, orderBy: { dueDate: "asc" } });
  if (firstDue) {
    await prisma.serviceOrder.create({ data: {
      id: "order_001", orderCode: "TK-01-26-000001", machineId: products[0].id,
      maintenanceScheduleId: firstDue.id, dealerId: dealer.id, technicianId: "usr_ktv",
      customerName: customer.name, customerPhone: customer.phone, address: customer.address,
      serviceType: firstDue.title, status: "ASSIGNED", dueDate: firstDue.dueDate,
      serviceFee: 180000, paymentStatus: "PENDING",
    } });
    await prisma.maintenanceSchedule.update({ where: { id: firstDue.id }, data: { status: "ORDER_CREATED" } });
  }



  const centralWarehouse = await prisma.warehouse.create({ data: {
    id: "warehouse_central", code: "KHO-TONG-HN", name: "Kho tổng KOSOVOTA Hà Nội", type: "CENTRAL", province: "Hà Nội", address: "Hà Nội"
  } });
  const dealerWarehouse = await prisma.warehouse.create({ data: {
    id: "warehouse_dealer_hn", code: "KHO-HN-DL-0001", name: "Kho Trung tâm Dịch vụ Hà Nội", type: "DEALER", dealerId: dealer.id, province: "Hà Nội", address: dealer.address
  } });
  await prisma.inventoryItem.createMany({ data: [
    { id: "item_pp1", sku: "LOI-PP-01", name: "Lõi PP số 1", category: "Lõi lọc", unit: "cái", minStock: 10, costPrice: 45000, salePrice: 90000 },
    { id: "item_core123", sku: "BO-LOI-123", name: "Bộ lõi 1-2-3", category: "Lõi lọc", unit: "bộ", minStock: 8, costPrice: 180000, salePrice: 350000 },
    { id: "item_ro", sku: "MANG-RO-100", name: "Màng RO 100G", category: "Màng RO", unit: "cái", minStock: 5, costPrice: 420000, salePrice: 750000 },
    { id: "item_t33", sku: "LOI-T33", name: "Lõi T33", category: "Lõi chức năng", unit: "cái", minStock: 6, costPrice: 95000, salePrice: 180000 },
  ] });
  await prisma.stockBalance.createMany({ data: [
    { warehouseId: centralWarehouse.id, itemId: "item_pp1", quantity: 120 },
    { warehouseId: centralWarehouse.id, itemId: "item_core123", quantity: 60 },
    { warehouseId: centralWarehouse.id, itemId: "item_ro", quantity: 25 },
    { warehouseId: centralWarehouse.id, itemId: "item_t33", quantity: 40 },
    { warehouseId: dealerWarehouse.id, itemId: "item_pp1", quantity: 14 },
    { warehouseId: dealerWarehouse.id, itemId: "item_core123", quantity: 8 },
    { warehouseId: dealerWarehouse.id, itemId: "item_ro", quantity: 3 },
  ] });
  const completedOrderPaid = await prisma.serviceOrder.create({ data: {
    id: "order_002", orderCode: "TK-01-26-000002", machineId: products[0].id, dealerId: dealer.id,
    customerName: customer.name, customerPhone: customer.phone, address: customer.address,
    serviceType: "Thay lõi số 1", status: "COMPLETED", dueDate: new Date("2026-06-01"),
    serviceFee: 180000, paymentStatus: "PAID",
  } });
  await prisma.serviceOrder.create({ data: {
    id: "order_003", orderCode: "TK-01-26-000003", machineId: products[0].id, dealerId: dealer.id,
    customerName: customer.name, customerPhone: customer.phone, address: customer.address,
    serviceType: "Kiểm tra và vệ sinh máy", status: "COMPLETED", dueDate: new Date("2026-06-12"),
    serviceFee: 150000, paymentStatus: "PENDING",
  } });
  await prisma.serviceReport.create({ data: {
    id: "report_002", machineId: products[0].id, orderId: completedOrderPaid.id, dealerCode: dealer.dealerCode,
    serviceType: completedOrderPaid.serviceType, products: "Lõi PP số 1", signature: customer.name, note: "Máy hoạt động tốt sau bảo trì"
  } });
  await prisma.stockMovement.createMany({ data: [
    { id: "movement_seed_1", movementCode: "KHO-2606-000001", type: "IN", itemId: "item_pp1", toWarehouseId: centralWarehouse.id, quantity: 120, unitCost: 45000, note: "Tồn đầu kỳ", createdById: "usr_admin" },
    { id: "movement_seed_2", movementCode: "KHO-2606-000002", type: "TRANSFER", itemId: "item_pp1", fromWarehouseId: centralWarehouse.id, toWarehouseId: dealerWarehouse.id, quantity: 15, unitCost: 45000, note: "Cấp hàng đầu kỳ", createdById: "usr_admin" },
    { id: "movement_seed_3", movementCode: "KHO-2606-000003", type: "SERVICE_USE", itemId: "item_pp1", fromWarehouseId: dealerWarehouse.id, serviceOrderId: completedOrderPaid.id, quantity: 1, unitCost: 45000, note: "Sử dụng cho lệnh dịch vụ", createdById: "usr_dealer" },
  ] });
  await prisma.paymentBatch.create({ data: {
    id: "payment_batch_001", batchCode: "DS-2606-00001", dealerId: dealer.id, periodStart: new Date("2026-06-01"), periodEnd: new Date("2026-06-10"),
    status: "PAID", grossAmount: 225000, deductions: 0, netAmount: 225000, bankReference: "GD-TEST-2606", approvedAt: new Date("2026-06-11"), paidAt: new Date("2026-06-12"), createdById: "usr_admin",
    lines: { create: [{ serviceOrderId: completedOrderPaid.id, serviceAmount: 180000, materialAmount: 45000, totalAmount: 225000 }] }
  } });

  await prisma.customerActivity.createMany({ data: [
    { id: "activity_001", customerId: customer.id, type: "CALL", summary: "Gọi xác nhận trải nghiệm sản phẩm", detail: "Khách hàng hài lòng, máy vận hành ổn định.", userId: "usr_cskh", occurredAt: new Date("2026-06-15T09:30:00") },
    { id: "activity_002", customerId: customer.id, type: "ZALO", summary: "Gửi lịch thay lõi định kỳ", detail: "Đã gửi lịch chăm sóc qua Zalo.", userId: "usr_cskh", occurredAt: new Date("2026-06-16T14:00:00") },
  ] });
  const supportTicket = await prisma.supportTicket.create({ data: {
    id: "ticket_001", ticketCode: "YC-2606-000001", type: "WARRANTY", source: "CUSTOMER", subject: "Kiểm tra tiếng ồn khi máy chạy",
    description: "Khách hàng phản ánh máy có tiếng rung nhẹ khi bơm hoạt động.", status: "IN_PROGRESS", priority: "NORMAL", customerId: customer.id, machineId: products[0].id, dealerId: dealer.id, assigneeId: "usr_cskh", contactName: customer.name, contactPhone: customer.phone, dueAt: new Date("2026-06-20T17:00:00")
  } });
  await prisma.ticketMessage.createMany({ data: [
    { ticketId: supportTicket.id, authorId: "usr_cskh", authorName: "CSKH Hà Nội", message: "Đã tiếp nhận và giao đại lý kiểm tra tại nhà." },
    { ticketId: supportTicket.id, authorId: "usr_dealer", authorName: "Trung tâm dịch vụ Hà Nội", message: "Đã hẹn khách hàng chiều 19/06/2026." },
  ] });

  await prisma.idSequence.createMany({ data: [
    { key: "SERVICE_ORDER:26", value: 3 },
    { key: "DEALER:HN:DL:26", value: 1 },
    { key: "STOCK_MOVEMENT:2606", value: 3 },
    { key: "SUPPORT_TICKET:2606", value: 1 },
    { key: "PAYMENT_BATCH:2606", value: 1 },
  ] });

  console.log("Đã tạo dữ liệu kiểm thử KOSOVOTA.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
