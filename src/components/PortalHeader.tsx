"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PortalHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">{eyebrow}</p>
          <h1 className="truncate text-xl font-black text-slate-950 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/" className="hidden rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:inline-flex">Trang chủ</Link>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {loggingOut ? "Đang thoát..." : "Đăng xuất"}
          </button>
        </div>
      </div>
    </header>
  );
}
