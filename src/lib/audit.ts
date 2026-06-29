import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function writeAudit(input: {
  request?: NextRequest;
  userId?: string | null;
  action: string;
  target?: string | null;
  detail?: unknown;
}) {
  const request = input.request;
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return prisma.adminLog.create({
    data: {
      userId: input.userId || null,
      action: input.action,
      target: input.target || null,
      detail: input.detail == null ? null : typeof input.detail === "string" ? input.detail : JSON.stringify(input.detail),
      ipAddress: forwarded || request?.headers.get("x-real-ip") || null,
      userAgent: request?.headers.get("user-agent")?.slice(0, 500) || null,
      requestId: request?.headers.get("x-request-id") || crypto.randomUUID(),
    },
  });
}
