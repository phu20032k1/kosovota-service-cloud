import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;

function otpSecret() {
  const secret = process.env.OTP_SECRET || process.env.SESSION_SECRET;
  if (secret && (process.env.NODE_ENV !== "production" || secret.length >= 32)) return secret;
  if (process.env.NODE_ENV !== "production") return "kosovota-local-otp-secret-change-before-deploy";
  throw new Error("Thiếu OTP_SECRET tối thiểu 32 ký tự trong production");
}

function hashOtp(phone: string, purpose: string, code: string) {
  return createHash("sha256").update(`${otpSecret()}:${phone}:${purpose}:${code}`).digest("hex");
}

function resolveOtpChannel(requested?: "SMS" | "ZALO") {
  const channel = (requested || process.env.OTP_CHANNEL || "SMS").toUpperCase();
  return channel === "ZALO" ? "ZALO" : "SMS";
}

export async function issueOtp(options: {
  phone: string;
  purpose: string;
  channel?: "SMS" | "ZALO";
  message: (code: string) => string;
}) {
  const phone = normalizePhone(options.phone);
  if (process.env.NODE_ENV === "production" && process.env.OTP_FIXED_CODE) {
    throw new Error("Không được cấu hình OTP_FIXED_CODE trong production");
  }
  const code = process.env.NODE_ENV !== "production" && process.env.OTP_FIXED_CODE
    ? process.env.OTP_FIXED_CODE
    : String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
  const channel = resolveOtpChannel(options.channel);
  const content = options.message(code);
  const templateId = process.env.ZALO_ZBS_OTP_TEMPLATE_ID || process.env.ZALO_ZBS_TEMPLATE_ID;

  await prisma.$transaction(async (tx) => {
    await tx.otpCode.updateMany({
      where: { phone, purpose: options.purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await tx.otpCode.create({
      data: {
        phone,
        purpose: options.purpose,
        codeHash: hashOtp(phone, options.purpose, code),
        expiresAt,
      },
    });

    await tx.notification.create({
      data: {
        phone,
        channel,
        kind: "OTP",
        content,
        payload: channel === "ZALO"
          ? JSON.stringify({
              templateId,
              templateData: {
                otp: code,
                code,
                expire_time: `${OTP_TTL_MINUTES} phút`,
                message: content,
              },
            })
          : null,
        status: "PENDING",
      },
    });
  });

  return {
    expiresAt,
    ...(process.env.OTP_DEBUG === "true" ? { debugCode: code } : {}),
  };
}

export async function consumeOtp(phoneValue: string, purpose: string, code: string) {
  const phone = normalizePhone(phoneValue);
  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || otp.expiresAt.getTime() < Date.now() || otp.attempts >= MAX_ATTEMPTS) {
    return { ok: false as const, message: "Mã OTP đã hết hạn hoặc không còn hiệu lực." };
  }

  const valid = otp.codeHash === hashOtp(phone, purpose, code);
  if (!valid) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false as const, message: "Mã OTP không đúng." };
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true as const, phone };
}
