import "dotenv/config";

const errors = [];
const warnings = [];
const value = (name) => (process.env[name] || "").trim();
const required = (name) => {
  if (!value(name)) errors.push(`Thiếu ${name}`);
};
const minLength = (name, length) => {
  if (value(name).length < length) errors.push(`${name} cần ít nhất ${length} ký tự`);
};

required("DATABASE_URL");
if (value("DATABASE_URL").startsWith("file:")) errors.push("Production không được dùng SQLite file:. Hãy dùng PostgreSQL.");
minLength("SESSION_SECRET", 32);
minLength("OTP_SECRET", 32);
minLength("CRON_SECRET", 32);
required("NEXT_PUBLIC_APP_URL");
if (value("NEXT_PUBLIC_APP_URL") && !value("NEXT_PUBLIC_APP_URL").startsWith("https://")) errors.push("NEXT_PUBLIC_APP_URL production phải dùng https://");
if (value("OTP_FIXED_CODE")) errors.push("Phải xóa OTP_FIXED_CODE khỏi production");
if (value("OTP_DEBUG") !== "false") errors.push('OTP_DEBUG phải là "false"');
if (value("NOTIFICATION_DRY_RUN") !== "false") warnings.push('NOTIFICATION_DRY_RUN chưa là "false": hệ thống sẽ không gửi SMS/Zalo thật.');

if ((value("OTP_CHANNEL") || "SMS").toUpperCase() === "SMS") {
  required("ESMS_API_KEY");
  required("ESMS_SECRET_KEY");
  required("ESMS_BRANDNAME");
  if (value("ESMS_SANDBOX") !== "false") warnings.push('ESMS_SANDBOX chưa là "false": SMS sẽ chỉ chạy sandbox.');
}

const storage = (value("STORAGE_PROVIDER") || "local").toLowerCase();
if (storage !== "r2" && value("ALLOW_LOCAL_UPLOADS") !== "true") {
  errors.push("Production cần STORAGE_PROVIDER=r2, hoặc chủ động ALLOW_LOCAL_UPLOADS=true.");
}
if (storage === "r2") {
  for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"]) required(name);
  if (value("R2_PUBLIC_BASE_URL") && !value("R2_PUBLIC_BASE_URL").startsWith("https://")) errors.push("R2_PUBLIC_BASE_URL phải dùng https://");
}

if (value("ALLOW_DEMO_SEED") === "true") errors.push("ALLOW_DEMO_SEED phải là false ở production");

console.log("\nKOSOVOTA production environment check\n");
for (const warning of warnings) console.warn(`CẢNH BÁO: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`LỖI: ${error}`);
  process.exit(1);
}
console.log("OK: Các biến môi trường bắt buộc đã đạt kiểm tra cơ bản.");
