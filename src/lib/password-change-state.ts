import { prisma } from "@/lib/prisma";

export async function mustChangePassword(userId: string) {
  const latest = await prisma.adminLog.findFirst({
    where: { userId, action: { in: ["FORCE_PASSWORD_CHANGE", "PASSWORD_CHANGED"] } },
    orderBy: { createdAt: "desc" },
    select: { action: true },
  });
  return latest?.action === "FORCE_PASSWORD_CHANGE";
}
