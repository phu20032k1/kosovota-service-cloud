"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";

const items = [
  { href: "/", label: "Trang chủ" },
  { href: "/about", label: "Giới thiệu" },
  { href: "/map", label: "Bản đồ" },
  { href: "/contact", label: "Liên hệ" },
];

export function PublicNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-950/10 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="KOSOVOTA - Trang chủ"><Brand /></Link>
        <nav className="hidden items-center gap-1 rounded-2xl bg-slate-100/80 p-1 text-sm font-bold text-slate-600 md:flex">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={`rounded-xl px-4 py-2.5 transition ${active ? "bg-white text-emerald-700 shadow-sm" : "hover:bg-white hover:text-emerald-700"}`}>{item.label}</Link>;
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-primary hidden items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white sm:inline-flex"><Icon name="lock" size={17}/> Đăng nhập</Link>
          <button type="button" onClick={() => setOpen((value) => !value)} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 md:hidden" aria-label="Mở menu"><Icon name={open ? "x" : "menu"} size={21}/></button>
        </div>
      </div>
      {open && <nav className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
        <div className="mx-auto grid max-w-7xl gap-1">
          {items.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`rounded-xl px-4 py-3 text-sm font-extrabold ${pathname === item.href ? "bg-emerald-50 text-emerald-700" : "text-slate-700 hover:bg-slate-50"}`}>{item.label}</Link>)}
          <Link href="/login" onClick={() => setOpen(false)} className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-extrabold text-white"><Icon name="lock" size={17}/> Đăng nhập</Link>
        </div>
      </nav>}
    </header>
  );
}
