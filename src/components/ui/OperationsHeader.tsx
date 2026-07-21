"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Brand } from "./Brand";
import { Icon, type IconName } from "./Icon";
import { homeForRole, ROLE_LABEL, type InternalRole } from "@/lib/access-control";

type SessionUser = { name: string; role: InternalRole };
type NavItem = { href: string; label: string; icon: IconName };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/executive", label: "Điều hành", icon: "activity" },
  { href: "/admin/customers", label: "Khách hàng", icon: "users" },
  { href: "/admin/dealers", label: "Đại lý", icon: "store" },
  { href: "/admin/users", label: "Tài khoản", icon: "users" },
  { href: "/admin/tickets", label: "Yêu cầu", icon: "alert" },
  { href: "/admin/inventory", label: "Kho", icon: "package" },
  { href: "/admin/payments", label: "Đối soát", icon: "wallet" },
  { href: "/operations-map", label: "Điều phối", icon: "map" },
  { href: "/customer-map", label: "Bản đồ máy", icon: "droplet" },
  { href: "/dealer-map", label: "Bản đồ đại lý", icon: "map" },
  { href: "/admin/reports", label: "Dữ liệu", icon: "database" },
  { href: "/admin/notifications", label: "Thông báo", icon: "bell" },
  { href: "/scan", label: "Quét QR", icon: "qr" },
  { href: "/admin/integrations", label: "Tích hợp", icon: "settings" },
  { href: "/admin/audit-logs", label: "Nhật ký", icon: "shield" },
];

const CSKH_NAV: NavItem[] = [
  { href: "/csos", label: "Công việc", icon: "calendar" },
  { href: "/cskh/customers", label: "Khách hàng", icon: "users" },
  { href: "/cskh/tickets", label: "Yêu cầu", icon: "alert" },
  { href: "/operations-map", label: "Điều phối", icon: "map" },
  { href: "/customer-map", label: "Bản đồ máy", icon: "droplet" },
  { href: "/dealer-map", label: "Bản đồ đại lý", icon: "store" },
  { href: "/scan", label: "Quét QR", icon: "qr" },
];

export function OperationsHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (cancelled) return;
        if (!response.ok || !result.success) { router.replace("/login"); return; }
        setUser(result.user);
      })
      .catch(() => { if (!cancelled) router.replace("/login"); });
    return () => { cancelled = true; };
  }, [router]);

  const nav = useMemo(() => user?.role === "ADMIN" ? ADMIN_NAV : user?.role === "CSKH" ? CSKH_NAV : [], [user?.role]);
  const home = homeForRole(user?.role);

  async function logout() {
    setLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.replace("/login"); router.refresh(); }
  }

  return (
    <header className="ops-header">
      <div className="ops-header-inner">
        <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Brand compact href={home} />
            <span className="hidden h-8 w-px bg-slate-200 sm:block" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-extrabold uppercase tracking-[.2em] text-emerald-700">{user ? ROLE_LABEL[user.role] : "KOSOVOTA Operations"}</p>
              <h1 className="truncate text-lg font-extrabold text-slate-950 sm:text-xl">{title}</h1>
              {subtitle && <p className="mt-0.5 hidden truncate text-xs text-slate-500 lg:block">{subtitle}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {user && <span className="hidden max-w-40 truncate text-xs font-bold text-slate-500 xl:block">{user.name}</span>}
            <button type="button" onClick={logout} disabled={loggingOut} className="icon-button" title="Đăng xuất" aria-label="Đăng xuất"><Icon name="log-out" size={18}/></button>
          </div>
        </div>
        <nav className="ops-nav" aria-label="Điều hướng vận hành">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <Link key={item.href} href={item.href} className={`ops-nav-link ${active ? "is-active" : ""}`}><Icon name={item.icon} size={17}/><span>{item.label}</span></Link>;
          })}
        </nav>
      </div>
    </header>
  );
}
