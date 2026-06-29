import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { normalizePhone, isValidVietnamPhone } from "../src/lib/phone";

const prisma = new PrismaClient();

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}

async function upsertRootUser(input: { phone: string; password: string; name: string; role: "SUPER_ADMIN" | "ADMIN" }) {
  const phone = normalizePhone(input.phone);
  if (!isValidVietnamPhone(phone)) throw new Error(`Số điện thoại ${input.role} không hợp lệ`);
  if (input.password.length < 10) throw new Error(`Mật khẩu ${input.role} cần ít nhất 10 ký tự`);
  await prisma.user.upsert({
    where: { phone },
    create: { phone, password: hashPassword(input.password), name: input.name, role: input.role, active: true },
    update: { password: hashPassword(input.password), name: input.name, role: input.role, active: true, dealerCode: null, provinceScope: null },
  });
}

async function main() {
  await upsertRootUser({
    phone: required("SEED_SUPER_ADMIN_PHONE"),
    password: required("SEED_SUPER_ADMIN_PASSWORD"),
    name: process.env.SEED_SUPER_ADMIN_NAME?.trim() || "SUPER ADMIN KOSOVOTA",
    role: "SUPER_ADMIN",
  });
  await upsertRootUser({
    phone: required("SEED_ADMIN_PHONE"),
    password: required("SEED_ADMIN_PASSWORD"),
    name: process.env.SEED_ADMIN_NAME?.trim() || "Admin vận hành KOSOVOTA",
    role: "ADMIN",
  });
  console.log("Đã khởi tạo tài khoản gốc. Không tạo dữ liệu máy, khách hàng hoặc đại lý mẫu.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
