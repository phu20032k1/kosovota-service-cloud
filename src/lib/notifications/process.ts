import { prisma } from "@/lib/prisma";
import { deliverNotification } from "./providers";

const STALE_PROCESSING_MINUTES = 10;

export async function processNotificationQueue(limit = 20) {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000);
  await prisma.notification.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: staleBefore } },
    data: { status: "PENDING", error: "Tự khôi phục vì tiến trình gửi trước đó bị gián đoạn." },
  });

  const pending = await prisma.notification.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  const summary = { total: pending.length, sent: 0, failed: 0, retried: 0, items: [] as { id: string; status: string; error?: string }[] };

  for (const notification of pending) {
    if (notification.attempts >= notification.maxAttempts) {
      await prisma.notification.update({ where: { id: notification.id }, data: { status: "FAILED", error: notification.error || "Đã vượt số lần gửi tối đa." } });
      summary.failed += 1;
      summary.items.push({ id: notification.id, status: "FAILED", error: "Đã vượt số lần gửi tối đa." });
      continue;
    }

    const claimed = await prisma.notification.updateMany({
      where: { id: notification.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 }, error: null },
    });
    if (!claimed.count) continue;

    try {
      const result = await deliverNotification(notification);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "SENT", providerMessageId: result.providerMessageId, sentAt: new Date(), error: null },
      });
      summary.sent += 1;
      summary.items.push({ id: notification.id, status: "SENT" });
    } catch (value) {
      const error = value instanceof Error ? value.message : "Lỗi gửi thông báo không xác định.";
      const attempts = notification.attempts + 1;
      const terminal = attempts >= notification.maxAttempts;
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: terminal ? "FAILED" : "PENDING", error: error.slice(0, 1000) },
      });
      if (terminal) summary.failed += 1;
      else summary.retried += 1;
      summary.items.push({ id: notification.id, status: terminal ? "FAILED" : "PENDING", error });
    }
  }
  return summary;
}
