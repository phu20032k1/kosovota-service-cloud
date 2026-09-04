import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/session-token";
import { expandProvinceScope } from "@/lib/province";

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

  // Dữ liệu cũ có thể lưu "Hà Nội", "HN" hoặc "01". Mọi API phía sau đều
  // nhận một scope đã mở rộng đủ alias nên không còn tình trạng có quyền nhưng lọc ra rỗng.
  const aliases = expandProvinceScope(user.provinceScope);
  const effectiveScope = aliases.length ? aliases.join(",") : user.role === "CSKH" ? "__NO_SCOPE__" : user.provinceScope;
  return { session, user: { ...user, provinceScope: effectiveScope } };
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
