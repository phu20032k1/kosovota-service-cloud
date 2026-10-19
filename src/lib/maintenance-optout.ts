import { prisma } from "@/lib/prisma";

// Nhật ký này đồng thời lưu lựa chọn chăm sóc của từng máy, không phụ thuộc
// vào lịch bảo trì (có thể được tạo lại khi đồng bộ cấu hình).
export const CARE_DISABLED_ACTION = "DISABLE_MACHINE_CARE";
export const CARE_ENABLED_ACTION = "ENABLE_MACHINE_CARE";

export async function getOptedOutMachineIds(machineIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(machineIds.filter(Boolean))];
  if (!unique.length) return new Set();
  const logs = await prisma.adminLog.findMany({
    where: { target: { in: unique }, action: { in: [CARE_DISABLED_ACTION, CARE_ENABLED_ACTION] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { target: true, action: true },
  });
  const seen = new Set<string>();
  const disabled = new Set<string>();
  for (const log of logs) {
    if (!log.target || seen.has(log.target)) continue;
    seen.add(log.target);
    if (log.action === CARE_DISABLED_ACTION) disabled.add(log.target);
  }
  return disabled;
}
