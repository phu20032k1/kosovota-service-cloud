import { createHash, createHmac, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function awsEncodePath(value: string) {
  return value.split("/").map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");
}

async function uploadToR2(buffer: Buffer, key: string, contentType: string) {
  const accountId = required("R2_ACCOUNT_ID");
  const accessKey = required("R2_ACCESS_KEY_ID");
  const secretKey = required("R2_SECRET_ACCESS_KEY");
  const bucket = required("R2_BUCKET");
  const publicBaseUrl = required("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  const endpoint = (process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  const endpointUrl = new URL(endpoint);
  const host = endpointUrl.host;
  const region = (process.env.R2_REGION || "auto").trim();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(buffer);
  const canonicalUri = `/${awsEncodePath(bucket)}/${awsEncodePath(key)}`;
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`${endpoint}${canonicalUri}`, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization,
    },
    body: new Uint8Array(buffer),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`R2 upload lỗi ${response.status}: ${detail.slice(0, 300)}`);
  }
  return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function storeUpload(input: { buffer: Buffer; contentType: string; purpose: string }) {
  const extension = UPLOAD_TYPES[input.contentType];
  if (!extension) throw new Error("Loại tệp không được hỗ trợ");
  const date = new Date();
  const folder = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const safePurpose = input.purpose.replace(/[^a-z0-9-_]/gi, "-").toLowerCase() || "general";
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const key = `${safePurpose}/${folder}/${filename}`;
  const provider = (process.env.STORAGE_PROVIDER || "local").trim().toLowerCase();

  if (provider === "r2") return uploadToR2(input.buffer, key, input.contentType);
  if (provider !== "local") throw new Error(`STORAGE_PROVIDER không được hỗ trợ: ${provider}`);
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_UPLOADS !== "true") {
    throw new Error("Production phải cấu hình STORAGE_PROVIDER=r2 hoặc bật ALLOW_LOCAL_UPLOADS=true có chủ đích");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", safePurpose, folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), input.buffer);
  return `/uploads/${safePurpose}/${folder}/${filename}`;
}
