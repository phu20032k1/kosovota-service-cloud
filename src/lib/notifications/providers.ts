import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { normalizePhone } from "@/lib/phone";
import { renderEmailHtml } from "./email-template";

export type DeliveryResult = { providerMessageId: string; raw?: unknown };
export type DeliveryInput = {
  id: string;
  phone?: string | null;
  email?: string | null;
  recipientName?: string | null;
  channel: string;
  kind?: string | null;
  subject?: string | null;
  content: string;
  payload?: string | null;
};

function toInternationalPhone(value: string) {
  const phone = normalizePhone(value);
  return phone.startsWith("0") ? `84${phone.slice(1)}` : phone;
}

function parsePayload(value?: string | null): Record<string, unknown> {
  if (!value) return {};
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}; }
  catch { return {}; }
}

async function sendEsms(input: DeliveryInput): Promise<DeliveryResult> {
  if (!input.phone) throw new Error("Thiếu số điện thoại để gửi SMS.");
  const apiKey = process.env.ESMS_API_KEY;
  const secretKey = process.env.ESMS_SECRET_KEY;
  const isSandbox = process.env.ESMS_SANDBOX === "true";
  const brandname = process.env.ESMS_BRANDNAME || "";

  if (!apiKey || !secretKey) throw new Error("Thiếu ESMS_API_KEY hoặc ESMS_SECRET_KEY.");
  if (!isSandbox && !brandname) throw new Error("Thiếu ESMS_BRANDNAME. Brandname chỉ bắt buộc khi gửi thật.");

  const payload: Record<string, string | undefined> = {
    ApiKey: apiKey,
    SecretKey: secretKey,
    Phone: normalizePhone(input.phone),
    Content: input.content,
    SmsType: "2",
    IsUnicode: "1",
    Sandbox: isSandbox ? "1" : "0",
    RequestId: input.id.slice(0, 50),
    CallbackUrl: process.env.ESMS_CALLBACK_URL || undefined,
  };

  if (brandname) payload.Brandname = brandname;

  const response = await fetch("https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json() as { error?: number; message?: string; data?: { msg_id?: string }; msg_id?: string };
  if (!response.ok || Number(result.error || 0) !== 0) throw new Error(result.message || `ESMS trả về HTTP ${response.status}.`);
  return { providerMessageId: result.data?.msg_id || result.msg_id || input.id, raw: result };
}

async function sendZbs(input: DeliveryInput): Promise<DeliveryResult> {
  if (!input.phone) throw new Error("Thiếu số điện thoại để gửi Zalo.");
  const accessToken = process.env.ZALO_ZBS_ACCESS_TOKEN;
  const payload = parsePayload(input.payload);
  const templateId = String(payload.templateId || process.env.ZALO_ZBS_TEMPLATE_ID || "");
  if (!accessToken || !templateId) throw new Error("Thiếu ZALO_ZBS_ACCESS_TOKEN hoặc ZALO_ZBS_TEMPLATE_ID.");
  const templateData = payload.templateData && typeof payload.templateData === "object" ? payload.templateData : { message: input.content };
  const response = await fetch("https://business.openapi.zalo.me/message/template", {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: accessToken },
    body: JSON.stringify({ phone: toInternationalPhone(input.phone), template_id: templateId, template_data: templateData, tracking_id: input.id }),
  });
  const result = await response.json() as { error?: number; message?: string; data?: { msg_id?: string }; msg_id?: string };
  if (!response.ok || Number(result.error || 0) !== 0) throw new Error(result.message || `Zalo trả về HTTP ${response.status}.`);
  return { providerMessageId: result.data?.msg_id || result.msg_id || input.id, raw: result };
}

async function sendEmail(input: DeliveryInput): Promise<DeliveryResult> {
  if (!input.email) throw new Error("Thiếu email người nhận.");
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("Thiếu GMAIL_USER hoặc GMAIL_APP_PASSWORD.");

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user,
      pass,
    },
  });
  const subject = input.subject || "Thông báo từ KOSO VOTA";
  const html = renderEmailHtml({ title: subject, content: input.content });
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || `KOSO VOTA <${user}>`,
    to: input.recipientName ? `${input.recipientName} <${input.email}>` : input.email,
    subject,
    text: input.content,
    html,
    headers: {
      "X-Mailer": "KOSO VOTA Notification System",
      "X-Priority": "3",
    },
  });
  return { providerMessageId: info.messageId || crypto.randomUUID(), raw: info };
}

export async function deliverNotification(input: DeliveryInput): Promise<DeliveryResult> {
  if (process.env.NOTIFICATION_DRY_RUN !== "false") {
    console.info(`[DRY RUN] ${input.channel} -> ${input.email || input.phone || "unknown"}: ${input.subject ? `${input.subject} - ` : ""}${input.content}`);
    return { providerMessageId: `dry_${input.id}` };
  }
  const channel = input.channel.toUpperCase();
  if (channel === "SMS") {
    const provider = (process.env.SMS_PROVIDER || "esms").toLowerCase();
    if (provider !== "esms") throw new Error(`SMS_PROVIDER ${provider} chưa được hỗ trợ.`);
    return sendEsms(input);
  }
  if (channel === "ZALO") return sendZbs(input);
  if (channel === "EMAIL") return sendEmail(input);
  throw new Error(`Kênh ${input.channel} chưa được hỗ trợ.`);
}
