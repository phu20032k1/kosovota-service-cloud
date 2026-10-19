import { prisma } from "@/lib/prisma";
import { getOptedOutMachineIds } from "@/lib/maintenance-optout";
import { buildMaintenanceSchedulesFromTemplates, type MaintenanceTemplate } from "@/lib/maintenance";
import { getConfiguredMaintenanceTemplates } from "@/lib/maintenance-config";
import { createOrderCode } from "@/lib/order-code";
import { queueDealerServiceOrderEmail, queueServiceOrderCreatedNotifications } from "@/lib/notifications/events";
import { expandProvinceScope, findProvince, provinceFromAddress } from "@/lib/province";

function prismaCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
}

function isReplacementTask(title: string) {
  return /thay|lõi|loi|màng|mang|vật liệu|vat lieu|bảo trì|bao tri/i.test(title);
}

export async function syncMissingMaintenanceSchedules(limitInput = 500) {
  const limit = Math.min(1_000, Math.max(1, Number(limitInput) || 500));
  const totalInstalled = await prisma.machine.count({ where: { installDate: { not: null } } });
  const machines = await prisma.machine.findMany({
    where: { installDate: { not: null } },
    select: {
      id: true,
      model: true,
      installDate: true,
      maintenanceSchedules: { select: { title: true, dueDate: true, status: true } },
    },
    orderBy: [{ installDate: "asc" }, { id: "asc" }],
    take: limit,
  });

  const optedOut = await getOptedOutMachineIds(machines.map((machine) => machine.id));
  let createdSchedules = 0;
  const syncedMachineIds: string[] = [];
  const failed: Array<{ machineId: string; reason: string }> = [];
  const templateCache = new Map<string, MaintenanceTemplate[]>();

  for (const machine of machines) {
    if (!machine.installDate || optedOut.has(machine.id)) continue;
    try {
      const cacheKey = machine.model.trim().toUpperCase();
      let templates = templateCache.get(cacheKey);
      if (!templates) {
        templates = await getConfiguredMaintenanceTemplates(machine.model);
        templateCache.set(cacheKey, templates);
      }

      const desired = buildMaintenanceSchedulesFromTemplates(machine.id, machine.installDate, templates);
      // So khớp theo số lượng từng nội dung thay vì đúng ngày tuyệt đối.
      // Nhờ đó Admin/CSKH có thể điều chỉnh ngày của một lịch riêng mà cron
      // không tạo lại mốc cũ vào hôm sau.
      const existingCountByTitle = new Map<string, number>();
      for (const item of machine.maintenanceSchedules) {
        const key = item.title.trim().toLowerCase();
        existingCountByTitle.set(key, (existingCountByTitle.get(key) || 0) + 1);
      }
      const usedCountByTitle = new Map<string, number>();
      const missing = desired.filter((item) => {
        const key = item.title.trim().toLowerCase();
        const existingCount = existingCountByTitle.get(key) || 0;
        const usedCount = usedCountByTitle.get(key) || 0;
        if (usedCount < existingCount) {
          usedCountByTitle.set(key, usedCount + 1);
          return false;
        }
        return true;
      });

      const created = missing.length
        ? (await prisma.maintenanceSchedule.createMany({ data: missing })).count
        : 0;
      if (created) {
        createdSchedules += created;
        syncedMachineIds.push(machine.id);
      }
    } catch (error) {
      failed.push({
        machineId: machine.id,
        reason: error instanceof Error ? error.message : "Không tạo được lịch.",
      });
    }
  }

  return {
    scanned: machines.length,
    synced: syncedMachineIds.length,
    syncedMachineIds,
    createdSchedules,
    remaining: Math.max(0, totalInstalled - machines.length),
    failed,
  };
}

function normalizedTitle(value: string) {
  return value.trim().toLowerCase();
}

type ApprovedDealer = {
  id: string;
  dealerCode: string;
  name: string;
  phone: string;
  email: string | null;
  province: string | null;
  serviceArea: string | null;
};

function normalizeDealerCode(value?: string | null) {
  return value?.trim().toUpperCase() || "";
}

function machineProvinceCode(machineProvince?: string | null, customerAddress?: string | null) {
  return findProvince(machineProvince)?.[1] || provinceFromAddress(customerAddress)?.[1] || null;
}

function dealerServesProvince(dealer: ApprovedDealer, provinceCode: string | null) {
  if (!provinceCode) return false;
  const direct = findProvince(dealer.province)?.[1];
  if (direct === provinceCode) return true;
  return expandProvinceScope(dealer.serviceArea).some((value) => findProvince(value)?.[1] === provinceCode);
}

function chooseMaintenanceDealer(input: {
  activationDealerCode?: string | null;
  provinceCode?: string | null;
  customerAddress?: string | null;
  dealers: ApprovedDealer[];
}) {
  const activationDealerCode = normalizeDealerCode(input.activationDealerCode);
  if (activationDealerCode) {
    const activationDealer = input.dealers.find(
      (dealer) => normalizeDealerCode(dealer.dealerCode) === activationDealerCode,
    );
    if (activationDealer) return activationDealer;
  }

  const provinceCode = machineProvinceCode(input.provinceCode, input.customerAddress);
  if (!provinceCode) return null;
  return input.dealers.find((dealer) => dealerServesProvince(dealer, provinceCode)) || null;
}

function appBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "";
}

function dealerOrderNotification(input: {
  dealer: ApprovedDealer;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  address: string | null;
  serviceType: string;
}) {
  const baseUrl = appBaseUrl();
  const detailUrl = baseUrl ? `${baseUrl}/agent-portal` : "/agent-portal";
  return {
    phone: input.dealer.phone,
    channel: "ZALO",
    kind: "SERVICE_ORDER",
    content: [
      `KOSOVOTA: Đại lý có lệnh dịch vụ mới ${input.orderCode}.`,
      `Khách hàng: ${input.customerName} - ${input.customerPhone}.`,
      `Địa chỉ: ${input.address || "Chưa cập nhật"}.`,
      `Dịch vụ: ${input.serviceType}.`,
      `Chi tiết: ${detailUrl}`,
    ].join(" "),
    payload: JSON.stringify({
      templateId: process.env.ZALO_ZBS_SERVICE_ORDER_TEMPLATE_ID || process.env.ZALO_ZBS_TEMPLATE_ID,
      templateData: {
        order_code: input.orderCode,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        address: input.address || "Chưa cập nhật",
        service_name: input.serviceType,
        detail_url: detailUrl,
      },
    }),
  };
}

export async function generateDueMaintenanceOrders(throughInput: Date = new Date(), limitInput = 1_000) {
  const through = new Date(throughInput);
  if (Number.isNaN(through.getTime())) throw new Error("Mốc thời gian không hợp lệ.");
  const limit = Math.min(2_000, Math.max(1, Number(limitInput) || 1_000));

  const [schedules, approvedDealers] = await Promise.all([
    prisma.maintenanceSchedule.findMany({
      where: { status: "PENDING", dueDate: { lte: through }, serviceOrder: null },
      include: {
        machine: {
          include: {
            customer: true,
            activations: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: limit,
    }),
    prisma.dealer.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        dealerCode: true,
        name: true,
        phone: true,
        email: true,
        province: true,
        serviceArea: true,
      },
      orderBy: { dealerCode: "asc" },
    }),
  ]);

  const optedOut = await getOptedOutMachineIds(schedules.map((schedule) => schedule.machineId));
  let created = 0;
  let assigned = 0;
  let unassigned = 0;
  let skipped = 0;
  let careOnly = 0;
  const failed: Array<{ scheduleId: string; machineId: string; reason: string }> = [];
  const templateCache = new Map<string, MaintenanceTemplate[]>();

  for (const schedule of schedules) {
    if (optedOut.has(schedule.machineId)) { skipped += 1; continue; }
    const modelKey = schedule.machine.model.trim().toUpperCase();
    let templates = templateCache.get(modelKey);
    if (!templates) {
      templates = await getConfiguredMaintenanceTemplates(schedule.machine.model);
      templateCache.set(modelKey, templates);
    }
    const configuredTemplate = templates.find((item) => normalizedTitle(item.title) === normalizedTitle(schedule.title));
    if (configuredTemplate?.customerCare) {
      // Mốc chăm sóc chỉ cần nhắc CSKH/khách hàng, không tự biến thành lệnh kỹ thuật.
      careOnly += 1;
      skipped += 1;
      continue;
    }

    const customer = schedule.machine.customer;
    if (!customer?.phone) {
      skipped += 1;
      failed.push({ scheduleId: schedule.id, machineId: schedule.machineId, reason: "Máy chưa có số điện thoại khách hàng." });
      continue;
    }

    const dealer = chooseMaintenanceDealer({
      activationDealerCode: schedule.machine.activations[0]?.dealerCode,
      provinceCode: schedule.machine.provinceCode,
      customerAddress: customer.address,
      dealers: approvedDealers,
    });

    try {
      const orderCode = await createOrderCode(schedule.machine.provinceCode || "01");
      const order = await prisma.$transaction(async (tx) => {
        const current = await tx.maintenanceSchedule.findUnique({
          where: { id: schedule.id },
          include: { serviceOrder: { select: { id: true } } },
        });
        if (!current || current.status !== "PENDING" || current.serviceOrder) return null;

        const createdOrder = await tx.serviceOrder.create({
          data: {
            orderCode,
            machineId: schedule.machineId,
            maintenanceScheduleId: schedule.id,
            dealerId: dealer?.id || null,
            customerName: customer.name,
            customerPhone: customer.phone,
            address: customer.address,
            serviceType: schedule.title,
            dueDate: schedule.dueDate,
            status: dealer ? "ASSIGNED" : "NEW",
          },
        });
        await tx.maintenanceSchedule.update({
          where: { id: schedule.id },
          data: { status: "ORDER_CREATED" },
        });
        if (dealer) {
          await tx.notification.create({
            data: dealerOrderNotification({
              dealer,
              orderCode: createdOrder.orderCode,
              customerName: createdOrder.customerName,
              customerPhone: createdOrder.customerPhone,
              address: createdOrder.address,
              serviceType: createdOrder.serviceType,
            }),
          });
        }
        return createdOrder;
      });

      if (!order) {
        skipped += 1;
        continue;
      }

      created += 1;
      if (dealer) assigned += 1;
      else unassigned += 1;

      await queueServiceOrderCreatedNotifications({
        orderCode: order.orderCode,
        machineId: order.machineId,
        serviceType: order.serviceType,
        dueDate: order.dueDate,
        customer,
      });
      if (dealer) {
        await queueDealerServiceOrderEmail({
          dealer,
          orderCode: order.orderCode,
          machineId: order.machineId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          address: order.address,
          serviceType: order.serviceType,
        });
      }
    } catch (error) {
      if (prismaCode(error) === "P2002") {
        skipped += 1;
        continue;
      }
      skipped += 1;
      failed.push({
        scheduleId: schedule.id,
        machineId: schedule.machineId,
        reason: error instanceof Error ? error.message : "Không tạo được lệnh.",
      });
    }
  }

  return { scanned: schedules.length, created, assigned, unassigned, skipped, careOnly, failed, through };
}
