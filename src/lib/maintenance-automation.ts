import { prisma } from "@/lib/prisma";
import { buildMaintenanceSchedulesFromTemplates, type MaintenanceTemplate } from "@/lib/maintenance";
import { getConfiguredMaintenanceTemplates } from "@/lib/maintenance-config";
import { createOrderCode } from "@/lib/order-code";
import { queueServiceOrderCreatedNotifications } from "@/lib/notifications/events";

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
  const replacementTitleFilters = [
    { title: { contains: "thay", mode: "insensitive" as const } },
    { title: { contains: "lõi", mode: "insensitive" as const } },
    { title: { contains: "loi", mode: "insensitive" as const } },
    { title: { contains: "màng", mode: "insensitive" as const } },
    { title: { contains: "mang", mode: "insensitive" as const } },
    { title: { contains: "vật liệu", mode: "insensitive" as const } },
    { title: { contains: "vat lieu", mode: "insensitive" as const } },
    { title: { contains: "bảo trì", mode: "insensitive" as const } },
    { title: { contains: "bao tri", mode: "insensitive" as const } },
  ];

  const machines = await prisma.machine.findMany({
    where: {
      installDate: { not: null },
      maintenanceSchedules: { none: { OR: replacementTitleFilters } },
    },
    select: {
      id: true,
      model: true,
      installDate: true,
      maintenanceSchedules: { select: { title: true, dueDate: true } },
    },
    orderBy: { installDate: "asc" },
    take: limit,
  });

  let createdSchedules = 0;
  const syncedMachineIds: string[] = [];
  const failed: Array<{ machineId: string; reason: string }> = [];
  const templateCache = new Map<string, MaintenanceTemplate[]>();

  for (const machine of machines) {
    if (!machine.installDate) continue;
    try {
      const cacheKey = machine.model.trim().toUpperCase();
      let templates = templateCache.get(cacheKey);
      if (!templates) {
        templates = await getConfiguredMaintenanceTemplates(machine.model);
        templateCache.set(cacheKey, templates);
      }
      const desired = buildMaintenanceSchedulesFromTemplates(machine.id, machine.installDate!, templates!);
      const existingKeys = new Set(
        machine.maintenanceSchedules.map((item) => `${item.title.trim().toLowerCase()}|${item.dueDate.toISOString()}`),
      );
      const hasAnySchedules = machine.maintenanceSchedules.length > 0;
      const missing = desired.filter((item) => {
        if (hasAnySchedules && !isReplacementTask(item.title)) return false;
        return !existingKeys.has(`${item.title.trim().toLowerCase()}|${item.dueDate.toISOString()}`);
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

  const remaining = await prisma.machine.count({
    where: {
      installDate: { not: null },
      maintenanceSchedules: { none: { OR: replacementTitleFilters } },
    },
  });

  return {
    scanned: machines.length,
    synced: syncedMachineIds.length,
    syncedMachineIds,
    createdSchedules,
    remaining,
    failed,
  };
}

export async function generateDueMaintenanceOrders(throughInput: Date = new Date(), limitInput = 1_000) {
  const through = new Date(throughInput);
  if (Number.isNaN(through.getTime())) throw new Error("Mốc thời gian không hợp lệ.");
  const limit = Math.min(2_000, Math.max(1, Number(limitInput) || 1_000));

  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { status: "PENDING", dueDate: { lte: through }, serviceOrder: null },
    include: { machine: { include: { customer: true } } },
    orderBy: { dueDate: "asc" },
    take: limit,
  });

  let created = 0;
  let skipped = 0;
  const failed: Array<{ scheduleId: string; machineId: string; reason: string }> = [];

  for (const schedule of schedules) {
    const customer = schedule.machine.customer;
    if (!customer?.phone) {
      skipped += 1;
      failed.push({ scheduleId: schedule.id, machineId: schedule.machineId, reason: "Máy chưa có số điện thoại khách hàng." });
      continue;
    }

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
            customerName: customer.name,
            customerPhone: customer.phone,
            address: customer.address,
            serviceType: schedule.title,
            dueDate: schedule.dueDate,
            status: "NEW",
          },
        });
        await tx.maintenanceSchedule.update({
          where: { id: schedule.id },
          data: { status: "ORDER_CREATED" },
        });
        return createdOrder;
      });

      if (!order) {
        skipped += 1;
        continue;
      }

      created += 1;
      await queueServiceOrderCreatedNotifications({
        orderCode: order.orderCode,
        machineId: order.machineId,
        serviceType: order.serviceType,
        dueDate: order.dueDate,
        customer,
      });
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

  return { scanned: schedules.length, created, skipped, failed, through };
}
