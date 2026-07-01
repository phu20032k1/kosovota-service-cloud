"use client";

import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

export function SmartBackButton({
  label = "Quay lại",
  fallbackHref = "/login",
  className = "btn-secondary",
  icon = "chevron-right",
}: {
  label?: string;
  fallbackHref?: string;
  className?: string;
  icon?: IconName;
}) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  }

  return (
    <button type="button" onClick={goBack} className={className}>
      <Icon name={icon} size={18} className="rotate-180" /> {label}
    </button>
  );
}
