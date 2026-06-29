import "dotenv/config";
import { randomUUID } from "crypto";
import { deliverNotification } from "../src/lib/notifications/providers";
import { normalizePhone, isValidVietnamPhone } from "../src/lib/phone";

async function main() {
  const channel = String(process.argv[2] || "SMS").toUpperCase();
  const phone = normalizePhone(process.argv[3] || process.env.TEST_PHONE || "");
  if (!isValidVietnamPhone(phone)) {
    throw new Error("Thiếu số test. Dùng: npm run test:sms -- 09xxxxxxxx hoặc điền TEST_PHONE trong .env");
  }
  if (channel !== "SMS" && channel !== "ZALO") {
    throw new Error("Kênh chỉ được là SMS hoặc ZALO.");
  }

  let testTemplateData: Record<string, unknown> = {
    otp: "123456",
    code: "123456",
    expire_time: "5 phút",
    message: "KOSOVOTA kiểm tra kết nối Zalo.",
  };
  if (process.env.ZALO_ZBS_TEST_TEMPLATE_DATA) {
    testTemplateData = JSON.parse(process.env.ZALO_ZBS_TEST_TEMPLATE_DATA);
  }

  const id = `test_${randomUUID()}`;
  const result = await deliverNotification({
    id,
    phone,
    channel,
    kind: "INTEGRATION_TEST",
    content: channel === "SMS"
      ? "KOSOVOTA: Tin nhan kiem tra ket noi he thong. Vui long bo qua tin nay."
      : "KOSOVOTA kiểm tra kết nối Zalo.",
    payload: channel === "ZALO" ? JSON.stringify({
      templateId: process.env.ZALO_ZBS_OTP_TEMPLATE_ID || process.env.ZALO_ZBS_TEMPLATE_ID,
      templateData: testTemplateData,
    }) : null,
  });
  console.log("OK:", result);
  console.log(process.env.NOTIFICATION_DRY_RUN !== "false" ? "LƯU Ý: đang DRY RUN, chưa gửi thật." : "Đã gọi nhà cung cấp thật.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
