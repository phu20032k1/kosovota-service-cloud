import "dotenv/config";
import { deliverNotification } from "../src/lib/notifications/providers";

async function main() {
  const to = process.argv[2] || process.env.TEST_EMAIL || process.env.GMAIL_USER;
  if (!to) throw new Error("Thiếu email test. Dùng: npx tsx scripts/test-email.ts your@gmail.com hoặc đặt TEST_EMAIL trong .env");

  const result = await deliverNotification({
    id: `email_test_${Date.now()}`,
    channel: "EMAIL",
    email: to,
    recipientName: "Khách hàng test",
    subject: "KOSO VOTA - Test thông báo Gmail",
    content: [
      "Xin chào,",
      "Đây là email test từ hệ thống thông báo KOSO VOTA.",
      "Nếu bạn nhận được email này, Gmail SMTP và Notification Provider đã hoạt động.",
    ].join("\n"),
  });

  console.log("OK:", result);
  console.log(process.env.NOTIFICATION_DRY_RUN !== "false" ? "LƯU Ý: đang DRY RUN, chưa gửi thật." : "Đã gọi Gmail SMTP thật.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
