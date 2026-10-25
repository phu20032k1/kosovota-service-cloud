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

function cskhServiceOrderUrl(request: NextRequest, pathname: string) {
  const prefix = "/admin/service-orders/";
  const id = pathname.startsWith(prefix) ? pathname.slice(prefix.length).split("/")[0] : "";
  const url = request.nextUrl.clone();
  url.pathname = id ? `/cskh/service-orders/${encodeURIComponent(id)}` : "/csos";
  url.search = "";
  return url;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === SUPER_ADMIN_LOGIN_PAGE) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  // Một số màn hình dùng chung (ví dụ Lịch thay lõi) có thể còn link sâu tới
  // chi tiết lệnh dưới khu Admin. Với CSKH, chuyển sang trang chi tiết riêng
  // trong workspace CSKH thay vì trả về trang "Không đúng khu vực làm việc".
  if (session?.role === "CSKH" && (pathname === "/admin/service-orders" || pathname.startsWith("/admin/service-orders/"))) {
    return NextResponse.redirect(cskhServiceOrderUrl(request, pathname));
  }

  const allowedRoles = rolesForPath(pathname);

  if (allowedRoles) {
    if (!session) {
      return NextResponse.redirect(loginUrl(request));
    }

    if (!isInternalRole(session.role) || !allowedRoles.includes(session.role)) {
      return NextResponse.redirect(forbiddenUrl(request, session.role));
    }
  }

  // Luôn cho phép mở trang đăng nhập. Trạng thái active được kiểm tra lại từ DB
  // trong /api/auth/login và mọi API nghiệp vụ; không tin riêng token cũ để tránh
  // vòng lặp chuyển hướng sau khi Admin vừa khóa tài khoản.

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?)$).*)",
  ],
};
