"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ImportCustomersButton from "@/components/ImportCustomersButton";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";

type Customer = { id: string; name: string; phone: string; address?: string | null; segment?: string | null; satisfaction?: number | null; nextContactAt?: string | null; owner?: { name: string } | null; machines: { id: string; model: string; name?: string | null; status: string }[]; _count: { activities: number; tickets: number } };
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(value)) : "—";

export default function CustomersPage() {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState("ALL");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (segment !== "ALL") params.set("segment", segment);
      const response = await fetch(`/api/crm/customers?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được CRM");
      setData(result.data.customers);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không tải được CRM"); }
    finally { setLoading(false); }
  }, [q, segment]);
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);
  const stats = useMemo(() => ({ total: data.length, vip: data.filter((customer) => customer.segment === "VIP").length, follow: data.filter((customer) => Boolean(customer.nextContactAt)).length, risk: data.filter((customer) => (customer.satisfaction || 5) <= 2 || customer._count.tickets > 0).length }), [data]);

  return <main className="min-h-screen"><OperationsHeader title="Khách hàng 360°" subtitle="Một hồ sơ thống nhất cho máy, chăm sóc, dịch vụ và khiếu nại"/><div className="page-container space-y-6">
    {error && <Notice kind="error">{error}</Notice>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Khách hàng" value={stats.total} icon="users" tone="emerald"/><MetricCard label="Khách VIP" value={stats.vip} icon="star" tone="violet"/><MetricCard label="Có lịch liên hệ" value={stats.follow} icon="phone" tone="amber"/><MetricCard label="Cần quan tâm" value={stats.risk} icon="alert" tone="rose"/></section>
    <ImportCustomersButton onComplete={load}/>
    <section className="surface-card"><div className="data-toolbar"><div className="relative min-w-[260px] max-w-xl flex-1"><Icon name="search" size={18} className="pointer-events-none absolute left-3 top-3.5 text-slate-400"/><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm tên, số điện thoại hoặc địa chỉ" className="pl-10"/></div><select value={segment} onChange={(event) => setSegment(event.target.value)} className="max-w-48"><option value="ALL">Tất cả phân khúc</option><option value="STANDARD">Tiêu chuẩn</option><option value="VIP">VIP</option><option value="AT_RISK">Có nguy cơ</option><option value="INTERNAL">Nội bộ</option></select></div>
      {loading ? <LoadingState label="Đang tìm khách hàng..."/> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr>{["Khách hàng", "Phân khúc", "Thiết bị", "Tương tác", "Ticket", "CSKH phụ trách", "Liên hệ tiếp", "Đánh giá", ""].map((header) => <th key={header} className="p-3 text-left">{header}</th>)}</tr></thead><tbody>{data.map((customer) => <tr key={customer.id}><td className="p-3"><strong>{customer.name}</strong><div><a href={`tel:${customer.phone}`} className="text-emerald-700">{customer.phone}</a></div><div className="max-w-xs truncate text-xs text-slate-500">{customer.address || "Chưa có địa chỉ"}</div></td><td className="p-3"><span className={`status-badge ${customer.segment === "VIP" ? "badge-violet" : customer.segment === "AT_RISK" ? "badge-rose" : "badge-slate"}`}>{customer.segment || "STANDARD"}</span></td><td className="p-3"><strong>{customer.machines.length}</strong><div className="max-w-64 text-xs text-slate-500">{customer.machines.slice(0, 3).map((machine) => machine.name || machine.model || machine.id).join(", ")}</div></td><td className="p-3 font-bold">{customer._count.activities}</td><td className="p-3 font-bold">{customer._count.tickets}</td><td className="p-3">{customer.owner?.name || "Chưa giao"}</td><td className="p-3">{date(customer.nextContactAt)}</td><td className="p-3 font-black">{customer.satisfaction ? `${customer.satisfaction}/5` : "—"}</td><td className="p-3"><Link href={`/admin/customers/${customer.id}`} className="icon-button" title="Mở hồ sơ"><Icon name="chevron-right" size={18}/></Link></td></tr>)}{!data.length && <tr><td colSpan={9} className="p-10 text-center text-slate-500">Không tìm thấy khách hàng phù hợp.</td></tr>}</tbody></table></div>}
    </section>
  </div></main>;
}
