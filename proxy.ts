import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session-token";
import { homeForRole, rolesForPath, type InternalRole } from "@/lib/access-control";

const SESSION_COOKIE = "kosovota_session";
const AUTH_PAGES = new Set(["/login"]);

function loginUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (request.nextUrl.pathname !== "/") {
    url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  }
  return url;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const allowedRoles = rolesForPath(pathname);

  if (allowedRoles) {
    const role = session?.role;
    if (!session || !role || !allowedRoles.includes(role as InternalRole)) {
      return NextResponse.redirect(loginUrl(request));
    }
  }

  if (
    AUTH_PAGES.has(pathname) &&
    session &&
    typeof session.role === "string" &&
    session.role !== "CUSTOMER_PORTAL" &&
    session.role !== "RESET"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(session.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?)$).*)",
  ],
};
