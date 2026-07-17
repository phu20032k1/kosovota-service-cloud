import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

type Column = { key: string; label: string; align?: "left" | "right" };
type Report = { title: string; subtitle: string; columns: Column[]; rows: Record<string, string | number | null>[]; total: number };

const money = (value = 0) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const date = (value: Date | null | undefined) => value ? value.toLocaleDateString("vi-VN") : "—";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xem báo cáo lãnh đạo." }, { status: 403 });

  const key = request.nextUrl.searchParams.get("report");
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let report: Report;

  if (key === "machines") {
    const [rows, total] = await Promise.all([
      prisma.machine.findMany({ where: { customerId: { not: null } }, include: { customer: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
      prisma.machine.count({ where: { customerId: { not: null } } }),
    ]);
    report = { title: "Máy khách đang sử dụng", subtitle: "Thiết bị đã gắn với khách hàng, mới cập nhật trước.", total, columns: [
      { key: "machine", label: "Máy / serial" }, { key: "customer", label: "Khách hàng" }, { key: "phone", label: "Điện thoại" }, { key: "installed", label: "Ngày lắp" }, { key: "status", label: "Trạng thái" },
    ], rows: rows.map((row) => ({ machine: `${row.name || row.model}${row.serial ? ` · ${row.serial}` : ""}`, customer: row.customer?.name || "—", phone: row.customer?.phone || "—", installed: date(row.installDate), status: row.status, _href: `/admin/machines/${encodeURIComponent(row.id)}` })) };
  } else if (key === "revenue") {
    const [rows, total] = await Promise.all([
      prisma.serviceOrder.findMany({ where: { createdAt: { gte: startMonth }, status: "COMPLETED" }, include: { dealer: true }, orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.serviceOrder.count({ where: { createdAt: { gte: startMonth }, status: "COMPLETED" } }),
    ]);
    report = { title: "Doanh thu tháng", subtitle: "Các lệnh dịch vụ hoàn thành trong tháng hiện tại.", total, columns: [
      { key: "code", label: "Mã lệnh" }, { key: "customer", label: "Khách hàng" }, { key: "service", label: "Dịch vụ" }, { key: "dealer", label: "Đại lý" }, { key: "created", label: "Ngày tạo" }, { key: "amount", label: "Doanh thu", align: "right" },
    ], rows: rows.map((row) => ({ code: row.orderCode, customer: `${row.customerName} · ${row.customerPhone}`, service: row.serviceType, dealer: row.dealer?.name || "Chưa phân công", created: date(row.createdAt), amount: money(row.serviceFee || 0), _href: "/admin/reports" })) };
  } else if (key === "overdue") {
    const [rows, total] = await Promise.all([
      prisma.maintenanceSchedule.findMany({ where: { dueDate: { lt: now }, status: { not: "COMPLETED" } }, include: { machine: { include: { customer: true } } }, orderBy: { dueDate: "asc" }, take: 200 }),
      prisma.maintenanceSchedule.count({ where: { dueDate: { lt: now }, status: { not: "COMPLETED" } } }),
    ]);
    report = { title: "Lịch bảo trì quá hạn", subtitle: "Lịch chưa hoàn tất, quá hạn lâu nhất hiển thị trước.", total, columns: [
      { key: "due", label: "Hạn bảo trì" }, { key: "work", label: "Công việc" }, { key: "machine", label: "Máy" }, { key: "customer", label: "Khách hàng" }, { key: "phone", label: "Điện thoại" }, { key: "status", label: "Trạng thái" },
    ], rows: rows.map((row) => ({ due: date(row.dueDate), work: row.title, machine: row.machine.name || row.machine.model, customer: row.machine.customer?.name || "—", phone: row.machine.customer?.phone || "—", status: row.status, _href: `/admin/machines/${encodeURIComponent(row.machineId)}` })) };
  } else if (key === "tickets") {
    const where = { status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } };
    const [rows, total] = await Promise.all([
      prisma.supportTicket.findMany({ where, include: { customer: true, dealer: true, machine: true }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 200 }),
      prisma.supportTicket.count({ where }),
    ]);
    report = { title: "Ticket đang mở", subtitle: "Yêu cầu hỗ trợ chưa đóng, kèm người liên hệ và hạn xử lý.", total, columns: [
      { key: "code", label: "Mã ticket" }, { key: "subject", label: "Nội dung" }, { key: "contact", label: "Liên hệ" }, { key: "machine", label: "Máy" }, { key: "priority", label: "Ưu tiên" }, { key: "due", label: "Hạn xử lý" }, { key: "status", label: "Trạng thái" },
    ], rows: rows.map((row) => ({ code: row.ticketCode, subject: row.subject, contact: `${row.contactName} · ${row.contactPhone}`, machine: row.machine?.name || row.machine?.model || "—", priority: row.priority, due: date(row.dueAt), status: row.status, _href: "/admin/tickets" })) };
  } else if (key === "dealers") {
    const [rows, total] = await Promise.all([
      prisma.dealer.findMany({ where: { status: "APPROVED" }, include: { _count: { select: { serviceOrders: true, supportTickets: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
      prisma.dealer.count({ where: { status: "APPROVED" } }),
    ]);
    report = { title: "Đại lý hoạt động", subtitle: "Hồ sơ đại lý đã được duyệt và khối lượng công việc liên quan.", total, columns: [
      { key: "code", label: "Mã đại lý" }, { key: "name", label: "Đại lý" }, { key: "phone", label: "Điện thoại" }, { key: "province", label: "Tỉnh/TP" }, { key: "rating", label: "Đánh giá" }, { key: "orders", label: "Lệnh", align: "right" }, { key: "tickets", label: "Ticket", align: "right" },
    ], rows: rows.map((row) => ({ code: row.dealerCode, name: row.name, phone: row.phone, province: row.province || "—", rating: row.rating?.toFixed(1) || "—", orders: row._count.serviceOrders, tickets: row._count.supportTickets, _href: `/admin/dealers/${encodeURIComponent(row.id)}` })) };
  } else if (key === "inventory") {
    const [rows, total] = await Promise.all([
      prisma.stockBalance.findMany({ include: { item: true, warehouse: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
      prisma.stockBalance.count(),
    ]);
    report = { title: "Giá trị tồn kho", subtitle: "Số lượng, phần đã giữ chỗ và giá trị theo từng kho/vật tư.", total, columns: [
      { key: "warehouse", label: "Kho" }, { key: "sku", label: "Mã vật tư" }, { key: "item", label: "Vật tư" }, { key: "quantity", label: "Tồn", align: "right" }, { key: "reserved", label: "Giữ chỗ", align: "right" }, { key: "available", label: "Khả dụng", align: "right" }, { key: "value", label: "Giá trị", align: "right" },
    ], rows: rows.map((row) => ({ warehouse: row.warehouse.name, sku: row.item.sku, item: row.item.name, quantity: row.quantity, reserved: row.reserved, available: row.quantity - row.reserved, value: money(row.quantity * row.item.costPrice), _href: "/admin/inventory" })) };
  } else if (key === "paid" || key === "payable") {
    const statuses = key === "paid" ? ["PAID"] : ["SUBMITTED", "APPROVED"];
    const where = { status: { in: statuses } };
    const [rows, total] = await Promise.all([
      prisma.paymentBatch.findMany({ where, include: { dealer: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
      prisma.paymentBatch.count({ where }),
    ]);
    report = { title: key === "paid" ? "Đã thanh toán" : "Công nợ chờ xử lý", subtitle: key === "paid" ? "Các kỳ đối soát đã thanh toán cho đại lý." : "Các kỳ đối soát đang chờ duyệt hoặc chờ thanh toán.", total, columns: [
      { key: "code", label: "Mã kỳ" }, { key: "dealer", label: "Đại lý" }, { key: "period", label: "Kỳ đối soát" }, { key: "status", label: "Trạng thái" }, { key: "updated", label: "Cập nhật" }, { key: "amount", label: "Thành tiền", align: "right" },
    ], rows: rows.map((row) => ({ code: row.batchCode, dealer: row.dealer.name, period: `${date(row.periodStart)} – ${date(row.periodEnd)}`, status: row.status, updated: date(row.paidAt || row.approvedAt || row.updatedAt), amount: money(row.netAmount), _href: "/admin/payments" })) };
  } else {
    return NextResponse.json({ success: false, message: "Loại báo cáo không hợp lệ." }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: { ...report, generatedAt: new Date().toISOString() } });
}
