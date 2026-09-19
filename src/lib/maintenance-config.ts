import { PRODUCTS, findProductByModel } from "@/data/products";
import { prisma } from "@/lib/prisma";
import {
  buildMaintenanceSchedulesFromTemplates,
  getMaintenanceTemplates,
  type MaintenanceTemplate,
} from "@/lib/maintenance";

export const MAINTENANCE_CONFIG_ACTION = "MAINTENANCE_PLAN_CONFIG";

function modelKey(model: string) {
  const normalized = model.trim().toUpperCase();
  const product = findProductByModel(normalized);
  return product.modelCode === "UNKNOWN" ? normalized : product.modelCode;
}

export function normalizeMaintenanceTemplates(value: unknown): MaintenanceTemplate[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 24) {
    throw new Error("Chu kỳ cần từ 1 đến 24 mốc.");
  }

  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Mốc ${index + 1} không hợp lệ.`);
    const row = raw as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const days = Number(row.daysAfterInstallation);
    const months = Number(row.monthsAfterInstallation);
    const hasDays = Number.isInteger(days) && days > 0;
    const hasMonths = Number.isInteger(months) && months > 0;

    if (!title || title.length > 180) throw new Error(`Mốc ${index + 1} cần nội dung từ 1 đến 180 ký tự.`);
    if (hasDays === hasMonths) throw new Error(`Mốc ${index + 1} chỉ được chọn ngày hoặc tháng.`);
    if (hasDays && days > 3650) throw new Error(`Mốc ${index + 1} vượt quá 3650 ngày.`);
    if (hasMonths && months > 120) throw new Error(`Mốc ${index + 1} vượt quá 120 tháng.`);

    return {
      title,
      ...(hasDays ? { daysAfterInstallation: days } : { monthsAfterInstallation: months }),
      customerCare: Boolean(row.customerCare),
    };
  });
}

function readTemplates(detail?: string | null) {
  if (!detail) return null;
  try {
    const parsed = JSON.parse(detail) as { items?: unknown };
    return normalizeMaintenanceTemplates(parsed.items);
  } catch {
    return null;
  }
}

export async function getMaintenancePlanConfig(model: string) {
  const key = modelKey(model);
  const record = await prisma.adminLog.findFirst({
    where: { action: MAINTENANCE_CONFIG_ACTION, target: key },
    orderBy: { createdAt: "desc" },
    select: { detail: true, createdAt: true, userId: true },
  });
  const stored = readTemplates(record?.detail);
  return {
    modelCode: key,
    items: stored || getMaintenanceTemplates(model),
    source: stored ? "custom" as const : "default" as const,
    updatedAt: record?.createdAt || null,
    updatedById: record?.userId || null,
  };
}

export async function getConfiguredMaintenanceTemplates(model: string) {
  return (await getMaintenancePlanConfig(model)).items;
}

export async function buildConfiguredMaintenanceSchedules(machineId: string, installDate: Date, model: string) {
  const templates = await getConfiguredMaintenanceTemplates(model);
  return buildMaintenanceSchedulesFromTemplates(machineId, installDate, templates);
}

export async function saveMaintenancePlanConfig(input: {
  modelCode: string;
  items: unknown;
  userId?: string | null;
  applyExisting?: boolean;
}) {
  const product = PRODUCTS.find((item) => item.modelCode === input.modelCode);
  if (!product) throw new Error("Model không thuộc danh sách chu kỳ đang quản lý.");
  const items = normalizeMaintenanceTemplates(input.items);

  await prisma.adminLog.create({
    data: {
      userId: input.userId || null,
      action: MAINTENANCE_CONFIG_ACTION,
      target: product.modelCode,
      detail: JSON.stringify({ items }),
    },
  });

  let affectedMachines = 0;
  let recreatedSchedules = 0;

  if (input.applyExisting) {
    const aliases = [...new Set([product.modelCode, ...product.aliases].map((value) => value.toUpperCase()))];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const machines = await prisma.machine.findMany({
      where: { model: { in: aliases, mode: "insensitive" }, installDate: { not: null } },
      select: { id: true, installDate: true },
    });

    for (const machine of machines) {
      if (!machine.installDate) continue;
      const desired = buildMaintenanceSchedulesFromTemplates(machine.id, machine.installDate, items)
        .filter((item) => item.dueDate >= now);

      const existingFuture = await prisma.maintenanceSchedule.findMany({
        where: { machineId: machine.id, dueDate: { gte: now } },
        select: {
          title: true,
          dueDate: true,
          status: true,
          serviceOrder: { select: { id: true } },
        },
      });
      const lockedKeys = new Set(
        existingFuture
          .filter((item) => item.status !== "PENDING" || item.serviceOrder)
          .map((item) => `${item.title}|${item.dueDate.toISOString()}`),
      );

      const result = await prisma.$transaction(async (tx) => {
        await tx.maintenanceSchedule.deleteMany({
          where: {
            machineId: machine.id,
            status: "PENDING",
            dueDate: { gte: now },
            serviceOrder: null,
          },
        });
        const rows = desired.filter((item) => !lockedKeys.has(`${item.title}|${item.dueDate.toISOString()}`));
        if (!rows.length) return 0;
        const created = await tx.maintenanceSchedule.createMany({ data: rows });
        return created.count;
      });
      recreatedSchedules += result;
      affectedMachines += 1;
    }
  }

  return { modelCode: product.modelCode, items, affectedMachines, recreatedSchedules };
}
