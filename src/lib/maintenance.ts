import { findProductByModel } from "@/data/products";

export type MaintenanceTemplate = {
  title: string;
  monthsAfterInstallation?: number;
  daysAfterInstallation?: number;
  customerCare?: boolean;
};

/**
 * Lịch an toàn cho model mới/chưa được phân loại. Không đoán loại lõi cụ thể,
 * nhưng vẫn bảo đảm máy có các mốc chăm sóc và bảo trì để không bị bỏ quên.
 */
export const DEFAULT_MAINTENANCE_TEMPLATES: MaintenanceTemplate[] = [
  { title: "Tặng quà kích hoạt bảo hành", daysAfterInstallation: 4, customerCare: true },
  { title: "Chăm sóc trải nghiệm sản phẩm", monthsAfterInstallation: 1, customerCare: true },
  { title: "Kiểm tra / bảo trì định kỳ", monthsAfterInstallation: 3 },
  { title: "Kiểm tra / bảo trì định kỳ", monthsAfterInstallation: 6 },
  { title: "Kiểm tra / bảo trì định kỳ", monthsAfterInstallation: 12 },
  { title: "Kiểm tra / bảo trì định kỳ", monthsAfterInstallation: 24 },
];

export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getMaintenanceTemplates(model: string): MaintenanceTemplate[] {
  const configured = findProductByModel(model).maintenancePlan;
  return configured.length ? configured : DEFAULT_MAINTENANCE_TEMPLATES;
}

export function buildMaintenanceSchedules(
  machineId: string,
  installDate: Date,
  model: string,
) {
  return getMaintenanceTemplates(model).map((template) => ({
    machineId,
    title: template.title,
    dueDate:
      typeof template.daysAfterInstallation === "number"
        ? addDays(installDate, template.daysAfterInstallation)
        : addMonths(installDate, template.monthsAfterInstallation || 0),
    status: "PENDING",
  }));
}
