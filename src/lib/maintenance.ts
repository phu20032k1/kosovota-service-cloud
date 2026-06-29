import { findProductByModel } from "@/data/products";

export type MaintenanceTemplate = {
  title: string;
  monthsAfterInstallation?: number;
  daysAfterInstallation?: number;
  customerCare?: boolean;
};

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
  return findProductByModel(model).maintenancePlan;
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
