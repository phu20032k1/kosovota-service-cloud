import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session-token";
import { homeForRole, isInternalRole, rolesForPath } from "@/lib/access-control";

const SESSION_COOKIE = "kosovota_session";
const LOGIN_PAGE = "/login";
const SUPER_ADMIN_LOGIN_PAGE = "/super-admin/login";

function loginUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = request.nextUrl.pathname.startsWith("/super-admin")
    ? SUPER_ADMIN_LOGIN_PAGE
    : LOGIN_PAGE;
  url.search = "";
  url.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return url;
}

function forbiddenUrl(request: NextRequest, role: string | null | undefined) {
  const url = request.nextUrl.clone();
  url.pathname = "/khong-co-quyen";
  url.search = "";
  url.searchParams.set("from", request.nextUrl.pathname);
  url.searchParams.set("home", homeForRole(role));
  return url;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === SUPER_ADMIN_LOGIN_PAGE) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const allowedRoles = rolesForPath(pathname);

  if (allowedRoles) {
    if (!session) {
      return NextResponse.redirect(loginUrl(request));
    }

    if (!isInternalRole(session.role) || !allowedRoles.includes(session.role)) {
      return NextResponse.redirect(forbiddenUrl(request, session.role));
    }
  }

  if (pathname === LOGIN_PAGE && session && isInternalRole(session.role)) {
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
