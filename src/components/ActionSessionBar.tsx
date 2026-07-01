"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { SmartBackButton } from "@/components/SmartBackButton";

type User = { name: string; role: string };

export function ActionSessionBar({ title }: { title: string }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => ({ response, result: await response.json() })).then(({ response, result }) => {
      if (!response.ok || !result.success) { router.replace("/login"); return; }
      setUser(result.user);
    }).catch(() => router.replace("/login"));
  }, [router]);
    async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
  return <div className="mx-auto mb-5 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">{user?.role === "KTV" ? "Kỹ thuật viên" : "Đại lý"}</p><h1 className="font-black text-slate-950">{title}</h1>{user&&<p className="text-xs text-slate-500">{user.name}</p>}</div><div className="flex gap-2"><SmartBackButton label="Quay lại" className="btn-secondary text-sm" /><button type="button" onClick={logout} className="icon-button" title="Đăng xuất"><Icon name="log-out" size={17}/></button></div></div>;
}
