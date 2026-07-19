"use client";

import type { ReactNode } from "react";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { SmartBackButton } from "@/components/ui/SmartBackButton";

export function PortalHeader({ title, subtitle, homeLabel = "Trang chính", homeHref = "/", onLogout, children }: { title: string; subtitle?: string; homeLabel?: string; homeHref?: string; onLogout?: () => void; children?: ReactNode }) {
  return <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"><div className="mx-auto flex min-h-[72px] max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6"><div className="flex items-center gap-4"><span title={homeLabel}><Brand compact href={homeHref}/></span><span className="hidden h-8 w-px bg-slate-200 sm:block"/><div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">KOSOVOTA</p><h1 className="text-lg font-extrabold sm:text-xl">{title}</h1>{subtitle&&<p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}</div></div><div className="flex items-center gap-2">{children}<SmartBackButton label="Quay lại" fallbackHref={homeHref} className="btn-secondary hidden text-sm sm:inline-flex" />{onLogout&&<button type="button" onClick={onLogout} className="icon-button" title="Đăng xuất"><Icon name="log-out" size={18}/></button>}</div></div></header>;
}
