"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function ForcePasswordChangeGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/login" || pathname.startsWith("/customer-portal")) return;
    let cancelled = false;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !result.success) {
          router.replace("/login");
          router.refresh();
          return;
        }
        if (pathname !== "/change-password" && result.user?.mustChangePassword) {
          router.replace("/change-password");
          return;
        }
        if (pathname === "/change-password" && !result.user?.mustChangePassword) {
          router.replace("/");
        }
      } catch {
        // Lỗi mạng tạm thời không tự đăng xuất người dùng.
      }
    };

    void checkSession();
    const timer = window.setInterval(() => void checkSession(), 10_000);
    const onVisible = () => { if (document.visibilityState === "visible") void checkSession(); };
    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, router]);

  return null;
}
