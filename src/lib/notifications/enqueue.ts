import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

export type QueueNotificationInput = {
  channel: "SMS" | "ZALO" | "EMAIL" | string;
  phone?: string | null;
  email?: string | null;
  recipientName?: string | null;
  subject?: string | null;
  content: string;
  kind?: string | null;
  payload?: Record<string, unknown> | string | null;
};

export async function queueNotification(input: QueueNotificationInput) {
  const channel = input.channel.toUpperCase();
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const email = input.email ? input.email.trim().toLowerCase() : null;
  const content = input.content.trim();
  if (!content) throw new Error("Thiếu nội dung thông báo.");
  if (channel === "EMAIL" && !email) throw new Error("Thiếu email người nhận.");
  if ((channel === "SMS" || channel === "ZALO") && !phone) throw new Error("Thiếu số điện thoại người nhận.");

  const payload = typeof input.payload === "string" ? input.payload : input.payload ? JSON.stringify(input.payload) : null;
  return prisma.notification.create({
    data: {
      channel,
      phone,
      email,
      recipientName: input.recipientName || null,
      subject: input.subject || null,
      kind: input.kind || null,
      content,
      payload,
      status: "PENDING",
    },
  });
}
