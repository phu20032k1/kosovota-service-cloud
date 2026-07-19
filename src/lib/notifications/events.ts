import { prisma } from "@/lib/prisma";
import { queueNotification } from "./enqueue";

type Person = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
};

function cleanEmail(value?: string | null) {
  const email = value?.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return null;
  return email;
}

function formatDate(value?: Date | string | null) {
  if (!value) return "Chưa cập nhật";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN");
}

function joinLines(lines: Array<string | null | undefined | false>) {
  return lines.filter(Boolean).join("\n");
}

async function safeQueue(input: Parameters<typeof queueNotification>[0]) {
  try {
    return await queueNotification(input);
  } catch (error) {
    console.error("Queue notification failed", error);
    return null;
  }
}

async function queueEmail(person: Person, subject: string, content: string, kind: string, payload?: Record<string, unknown>) {
  const email = cleanEmail(person.email);
  if (!email) return null;
  return safeQueue({
    channel: "EMAIL",
    email,
    recipientName: person.name || undefined,
    subject,
    content,
    kind,
    payload,
  });
}

async function queueSms(person: Person, content: string, kind: string, payload?: Record<string, unknown>) {
  if (!person.phone) return null;
  return safeQueue({ channel: "SMS", phone: person.phone, content, kind, payload });
}

async function queueZalo(person: Person, content: string, kind: string, payload?: Record<string, unknown>) {
  if (!person.phone) return null;
  return safeQueue({ channel: "ZALO", phone: person.phone, content, kind, payload });
}

export async function queueStaffEmails(input: {
  subject: string;
  content: string;
  kind: string;
  roles?: string[];
  payload?: Record<string, unknown>;
}) {
  try {
    const roles = input.roles || ["ADMIN", "CSKH"];
    const users = await prisma.user.findMany({
      where: { active: true, role: { in: roles }, email: { not: null } },
      select: { email: true, name: true, role: true },
    });
    const seen = new Set<string>();
    let queued = 0;
    for (const user of users) {
      const email = cleanEmail(user.email);
      if (!email || seen.has(email)) continue;
      seen.add(email);
      const item = await queueEmail(
        { email, name: `${user.name} (${user.role})` },
        input.subject,
        input.content,
        input.kind,
        input.payload,
      );
      if (item) queued += 1;
    }
    return queued;
  } catch (error) {
    console.error("Queue staff emails failed", error);
    return 0;
  }
}

export async function queueActivationCompletedNotifications(input: {
  machineId: string;
  model?: string | null;
  warrantyMonths?: number | null;
  installDate?: Date | null;
  customer?: Person & { address?: string | null } | null;
  dealer?: Person & { dealerCode?: string | null } | null;
  installerName?: string | null;
  installerPhone?: string | null;
  maintenanceCount?: number;
}) {
  const warranty = input.warrantyMonths ? `${input.warrantyMonths} tháng` : "Theo chính sách sản phẩm";
  const subject = "KOSO VOTA - Kích hoạt thiết bị thành công";
  const customerContent = joinLines([
    `Xin chào ${input.customer?.name || "Quý khách"},`,
    "Thiết bị KOSO VOTA của Quý khách đã được kích hoạt thành công.",
    "",
    `Mã máy: ${input.machineId}`,
    input.model ? `Model: ${input.model}` : null,
    `Ngày lắp đặt: ${formatDate(input.installDate)}`,
    `Bảo hành: ${warranty}`,
    input.customer?.address ? `Địa chỉ: ${input.customer.address}` : null,
    input.installerName ? `Người lắp đặt: ${input.installerName}` : null,
    input.installerPhone ? `SĐT người lắp: ${input.installerPhone}` : null,
    input.maintenanceCount ? `Hệ thống đã tạo ${input.maintenanceCount} lịch bảo trì tự động.` : null,
    "",
    "Trân trọng,",
    "KOSO VOTA",
  ]);

  await queueEmail(input.customer || {}, subject, customerContent, "ACTIVATION_COMPLETED", { machineId: input.machineId });
  await queueSms(
    input.customer || {},
    `KOSOVOTA: May ${input.machineId} da kich hoat thanh cong. Bao hanh: ${warranty}.`,
    "ACTIVATION_COMPLETED_SMS",
    { machineId: input.machineId },
  );
  await queueZalo(
    input.customer || {},
    customerContent,
    "ACTIVATION_COMPLETED_ZALO",
    { machineId: input.machineId },
  );

  const dealerContent = joinLines([
    "Một máy đã được kích hoạt thành công.",
    `Mã máy: ${input.machineId}`,
    input.model ? `Model: ${input.model}` : null,
    `Khách hàng: ${input.customer?.name || "Chưa có"} - ${input.customer?.phone || "Chưa có SĐT"}`,
    input.customer?.address ? `Địa chỉ: ${input.customer.address}` : null,
    `Ngày lắp đặt: ${formatDate(input.installDate)}`,
    input.installerName ? `Người lắp đặt: ${input.installerName}` : null,
  ]);
  await queueEmail(input.dealer || {}, "KOSO VOTA - Máy đã kích hoạt", dealerContent, "DEALER_ACTIVATION_NOTICE", { machineId: input.machineId });
}

export async function queueSosNotifications(input: {
  ticketId: string;
  machineId: string;
  customer: Person & { address?: string | null };
  note?: string | null;
}) {
  await queueSms(
    input.customer,
    `KOSOVOTA da tiep nhan SOS cho may ${input.machineId}. Bo phan CSKH se lien he som.`,
    "SOS_CUSTOMER_SMS",
    { ticketId: input.ticketId, machineId: input.machineId },
  );
  await queueEmail(
    input.customer,
    "KOSO VOTA - Đã tiếp nhận yêu cầu SOS",
    joinLines([
      `Xin chào ${input.customer.name || "Quý khách"},`,
      `KOSO VOTA đã tiếp nhận yêu cầu SOS cho máy ${input.machineId}.`,
      "Bộ phận CSKH sẽ liên hệ và xử lý sớm nhất.",
      input.note ? `Ghi chú của Quý khách: ${input.note}` : null,
      "",
      "Trân trọng,",
      "KOSO VOTA",
    ]),
    "SOS_CUSTOMER_EMAIL",
    { ticketId: input.ticketId, machineId: input.machineId },
  );

  await queueStaffEmails({
    subject: `KOSO VOTA - SOS mới cho máy ${input.machineId}`,
    kind: "SOS_STAFF_EMAIL",
    payload: { ticketId: input.ticketId, machineId: input.machineId },
    content: joinLines([
      "Có yêu cầu SOS mới cần xử lý.",
      `Mã máy: ${input.machineId}`,
      `Khách hàng: ${input.customer.name || "Chưa có"}`,
      `SĐT: ${input.customer.phone || "Chưa có"}`,
      input.customer.address ? `Địa chỉ: ${input.customer.address}` : null,
      input.note ? `Ghi chú: ${input.note}` : null,
    ]),
  });
}

export async function queueServiceOrderCreatedNotifications(input: {
  orderCode: string;
  machineId: string;
  serviceType: string;
  dueDate?: Date | null;
  customer: Person & { address?: string | null };
}) {
  await queueEmail(
    input.customer,
    `KOSO VOTA - Lệnh dịch vụ ${input.orderCode}`,
    joinLines([
      `Xin chào ${input.customer.name || "Quý khách"},`,
      "KOSO VOTA đã tạo lệnh dịch vụ cho thiết bị của Quý khách.",
      "",
      `Mã lệnh: ${input.orderCode}`,
      `Mã máy: ${input.machineId}`,
      `Dịch vụ: ${input.serviceType}`,
      input.dueDate ? `Lịch dự kiến: ${formatDate(input.dueDate)}` : null,
      input.customer.address ? `Địa chỉ: ${input.customer.address}` : null,
      "",
      "Trân trọng,",
      "KOSO VOTA",
    ]),
    "SERVICE_ORDER_CUSTOMER_EMAIL",
    { orderCode: input.orderCode, machineId: input.machineId },
  );
}

export async function queueDealerServiceOrderEmail(input: {
  dealer: Person & { dealerCode?: string | null };
  orderCode: string;
  machineId: string;
  customerName: string;
  customerPhone: string;
  address?: string | null;
  serviceType: string;
}) {
  await queueEmail(
    input.dealer,
    `KOSO VOTA - Lệnh mới ${input.orderCode}`,
    joinLines([
      "Đại lý có lệnh dịch vụ mới cần xử lý.",
      `Mã lệnh: ${input.orderCode}`,
      `Mã máy: ${input.machineId}`,
      `Khách hàng: ${input.customerName} - ${input.customerPhone}`,
      input.address ? `Địa chỉ: ${input.address}` : null,
      `Dịch vụ: ${input.serviceType}`,
      "Vui lòng vào cổng đại lý để tiếp nhận và điều phối KTV.",
    ]),
    "DEALER_SERVICE_ORDER_EMAIL",
    { orderCode: input.orderCode, machineId: input.machineId },
  );
}

export async function queueTechnicianAssignedEmail(input: {
  technician: Person;
  orderCode: string;
  machineId: string;
  customerName: string;
  customerPhone: string;
  address?: string | null;
  serviceType: string;
  dueDate?: Date | null;
}) {
  await queueEmail(
    input.technician,
    `KOSO VOTA - Bạn được giao lệnh ${input.orderCode}`,
    joinLines([
      "Bạn vừa được giao một lệnh dịch vụ.",
      `Mã lệnh: ${input.orderCode}`,
      `Mã máy: ${input.machineId}`,
      `Khách hàng: ${input.customerName} - ${input.customerPhone}`,
      input.address ? `Địa chỉ: ${input.address}` : null,
      `Dịch vụ: ${input.serviceType}`,
      input.dueDate ? `Hạn xử lý: ${formatDate(input.dueDate)}` : null,
      "Vui lòng vào cổng KTV để tiếp nhận.",
    ]),
    "TECHNICIAN_ASSIGNED_EMAIL",
    { orderCode: input.orderCode, machineId: input.machineId },
  );
}

export async function queueServiceStatusEmail(input: {
  customer: Person;
  orderCode: string;
  machineId: string;
  status: string;
  serviceType: string;
}) {
  const statusText: Record<string, string> = {
    ACCEPTED: "Đại lý/KTV đã tiếp nhận lệnh.",
    IN_PROGRESS: "Lệnh đang được xử lý.",
    COMPLETED: "Lệnh đã hoàn thành.",
    CANCELLED: "Lệnh đã được hủy.",
    RESCHEDULED: "Lịch xử lý đã được điều chỉnh.",
    CUSTOMER_REJECTED: "Khách hàng đã từ chối lịch xử lý.",
    CUSTOMER_SELF_SERVICE: "Khách hàng tự xử lý/bảo trì theo hướng dẫn.",
  };
  await queueEmail(
    input.customer,
    `KOSO VOTA - Cập nhật lệnh ${input.orderCode}`,
    joinLines([
      `Xin chào ${input.customer.name || "Quý khách"},`,
      statusText[input.status] || `Lệnh được cập nhật trạng thái: ${input.status}`,
      "",
      `Mã lệnh: ${input.orderCode}`,
      `Mã máy: ${input.machineId}`,
      `Dịch vụ: ${input.serviceType}`,
      "",
      "Trân trọng,",
      "KOSO VOTA",
    ]),
    "SERVICE_STATUS_EMAIL",
    { orderCode: input.orderCode, machineId: input.machineId, status: input.status },
  );
}

export async function queueServiceCompletedEmail(input: {
  customer: Person;
  orderCode: string;
  machineId: string;
  serviceType: string;
  products?: string | null;
}) {
  await queueEmail(
    input.customer,
    `KOSO VOTA - Hoàn thành lệnh ${input.orderCode}`,
    joinLines([
      `Xin chào ${input.customer.name || "Quý khách"},`,
      "Lệnh dịch vụ của Quý khách đã được hoàn thành.",
      "",
      `Mã lệnh: ${input.orderCode}`,
      `Mã máy: ${input.machineId}`,
      `Dịch vụ: ${input.serviceType}`,
      input.products ? `Sản phẩm/vật tư: ${input.products}` : null,
      "",
      "Cảm ơn Quý khách đã sử dụng dịch vụ KOSO VOTA.",
    ]),
    "SERVICE_COMPLETED_EMAIL",
    { orderCode: input.orderCode, machineId: input.machineId },
  );
}

export async function queueMaintenanceReminderEmail(input: {
  scheduleId: string;
  machineId: string;
  title: string;
  dueDate: Date;
  customer: Person & { address?: string | null };
}) {
  await queueEmail(
    input.customer,
    `KOSO VOTA - Nhắc lịch ${input.title}`,
    joinLines([
      `Xin chào ${input.customer.name || "Quý khách"},`,
      "Thiết bị của Quý khách sắp đến lịch chăm sóc/bảo trì.",
      "",
      `Mã máy: ${input.machineId}`,
      `Nội dung: ${input.title}`,
      `Ngày dự kiến: ${formatDate(input.dueDate)}`,
      input.customer.address ? `Địa chỉ: ${input.customer.address}` : null,
      "",
      "KOSO VOTA hoặc đại lý phụ trách sẽ liên hệ để hỗ trợ khi cần.",
    ]),
    "MAINTENANCE_REMINDER",
    { scheduleId: input.scheduleId, machineId: input.machineId },
  );
}
