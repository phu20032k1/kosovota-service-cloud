import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/session-token";

export const SESSION_COOKIE = "kosovota_session";
export const CUSTOMER_COOKIE = "kosovota_customer";

export async function getRequestSession(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function getActiveUser(request: NextRequest) {
  const session = await getRequestSession(request);
  if (!session?.sub) return null;

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user?.active || user.role !== session.role) return null;
  return { session, user };
}

export async function hasRole(request: NextRequest, roles: string[]) {
  const auth = await getActiveUser(request);
  if (!auth) return null;

  return roles.includes(auth.user.role) ? auth : null;
}

export function isDealerOperator(role?: string | null) {
  return role === "DEALER" || role === "CTV" || role === "KTV";
}

export function isSuperAdmin(role?: string | null) {
  return role === "SUPER_ADMIN";
}

export async function getCustomerSession(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(CUSTOMER_COOKIE)?.value);
  return session?.purpose === "CUSTOMER_LOGIN" && session.role === "CUSTOMER_PORTAL" ? session : null;
}
