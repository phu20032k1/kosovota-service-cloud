"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { homeForRole } from "@/lib/access-control";

type User = { role?: string | null };

export function SmartBackButton({ label = "Quay lại", className = "btn-secondary" }: { label?: string; className?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (!cancelled && response.ok && result.success) setUser(result.user);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const fallbackHref = useMemo(() => homeForRole(user?.role), [user?.role]);

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  }

  return (
    <button type="button" onClick={goBack} className={className}>
      <Icon name="chevron-right" size={18} className="rotate-180" /> {label}
    </button>
  );
}
