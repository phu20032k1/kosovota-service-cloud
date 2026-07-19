type PrismaLikeError = {
  code?: unknown;
  message?: unknown;
  meta?: { modelName?: unknown; column?: unknown; target?: unknown } | null;
};

export function isMissingTicketDispatchMigration(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const prismaError = error as PrismaLikeError;
  const code = String(prismaError.code || "");
  const message = String(prismaError.message || "");
  const meta = prismaError.meta || {};
  const context = [meta.modelName, meta.column, meta.target, message]
    .filter(Boolean)
    .map(String)
    .join(" ");

  return code === "P2022" && /SupportTicket|serviceOrderId/i.test(context);
}

export function databaseErrorMessage(error: unknown, fallback: string) {
  if (isMissingTicketDispatchMigration(error)) {
    return "Cơ sở dữ liệu chưa có cột liên kết Ticket–Điều phối. Hãy chạy `npx prisma migrate deploy` rồi tải lại trang.";
  }
  return fallback;
}
