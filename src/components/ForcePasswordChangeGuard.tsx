"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function ForcePasswordChangeGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/change-password" || pathname === "/login" || pathname.startsWith("/customer-portal")) return;
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (!cancelled && response.ok && result.success && result.user?.mustChangePassword) router.replace("/change-password");
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [pathname, router]);

  return null;
}
