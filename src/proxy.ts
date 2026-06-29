import { NextRequest, NextResponse } from "next/server";
import { homeForRole, isInternalRole, rolesForPath } from "@/lib/access-control";
import { verifySessionToken } from "@/lib/session-token";

const PUBLIC_SUPER_LOGIN = "/super-admin/login";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === PUBLIC_SUPER_LOGIN) return NextResponse.next();

  const allowedRoles = rolesForPath(pathname);
  if (!allowedRoles) return NextResponse.next();

  const token = request.cookies.get("kosovota_session")?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    const loginPath = pathname.startsWith("/super-admin") ? PUBLIC_SUPER_LOGIN : "/login";
    const url = new URL(loginPath, request.url);
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (!isInternalRole(session.role) || !allowedRoles.includes(session.role)) {
    const url = new URL("/khong-co-quyen", request.url);
    url.searchParams.set("from", pathname);
    url.searchParams.set("home", homeForRole(session.role));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/super-admin/:path*",
    "/admin/:path*",
    "/cskh/:path*",
    "/csos/:path*",
    "/agent-portal/:path*",
    "/technician-portal/:path*",
    "/activate/:path*",
    "/service-report/:path*",
    "/customer-map/:path*",
    "/dealer-map/:path*",
    "/operations-map/:path*",
  ],
};
