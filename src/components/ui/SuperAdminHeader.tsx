"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "./Brand";
import { Icon } from "./Icon";

export function SuperAdminHeader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.replace("/super-admin/login"); router.refresh(); }
  }
  return <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950 text-white"><div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"><div className="flex items-center gap-4"><Brand compact inverse href="/super-admin"/><div><p className="text-[10px] font-black uppercase tracking-[.24em] text-amber-300">Khu quản trị gốc tách biệt</p><h1 className="font-black">SUPER ADMIN CONTROL</h1></div></div><button type="button" onClick={logout} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50"><Icon name="log-out" size={17}/>{busy ? "Đang thoát" : "Đăng xuất"}</button></div></header>;
}
