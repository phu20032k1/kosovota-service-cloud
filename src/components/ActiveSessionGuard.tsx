"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const PUBLIC_PREFIXES = ["/login", "/change-password", "/customer-portal", "/dealer-registration", "/qr/", "/activation/", "/m/"];

export default function ActiveSessionGuard() {
  const pathname = usePathname();
  const knownAuthenticated = useRef(false);
  const checking = useRef(false);

  useEffect(() => {
    if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) return;

    let stopped = false;
    async function check() {
      if (checking.current || stopped) return;
      checking.current = true;
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (response.ok) {
          const result = await response.json().catch(() => null);
          if (result?.success && result?.user) knownAuthenticated.current = true;
          return;
        }
        if (response.status === 401 && knownAuthenticated.current && !stopped) {
          window.location.replace("/login?reason=account-locked");
        }
      } catch {
        // Do not log users out on transient network errors.
      } finally {
        checking.current = false;
      }
    }

    void check();
    const timer = window.setInterval(() => void check(), 15000);
    const onFocus = () => void check();
    const onVisibility = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  return null;
}
