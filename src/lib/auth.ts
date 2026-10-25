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

  // CSKH là vai trò điều phối toàn quốc: phải nhìn thấy đầy đủ lịch thay lõi,
  // yêu cầu, công việc, báo cáo, khách hàng và máy để có thể chăm sóc/điều phối.
  // Các trường scope vẫn được giữ trong DB để có thể dùng lại sau này khi nghiệp vụ
  // có chế độ giới hạn rõ ràng, nhưng không được phép vô tình làm mất dữ liệu của CSKH.
  if (user.role === "CSKH") {
    return {
      session,
      user: {
        ...user,
        provinceScope: null,
        wardScope: null,
        customerScope: null,
      },
    };
  }

  const aliases = expandProvinceScope(user.provinceScope);
  const effectiveScope = aliases.length ? aliases.join(",") : user.provinceScope;
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
