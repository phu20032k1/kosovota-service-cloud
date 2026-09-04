"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";

type Machine = { id: string; model: string; name?: string | null; serial?: string | null; status: string };
type Customer = {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  segment?: string | null;
  satisfaction?: number | null;
  nextContactAt?: string | null;
  owner?: { name: string } | null;
  machines: Machine[];
  _count: { activities: number; tickets: number };
};

const date = (value?: string | null) => value
  ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(value))
  : "—";

export default function CustomersPage() {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState("ALL");
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (segment !== "ALL") params.set("segment", segment);
        const response = await fetch(`/api/crm/customers?${params}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Không tải được CRM");
        setData(result.data.customers || []);
      } catch (value) {
        if (value instanceof DOMException && value.name === "AbortError") return;
        setError(value instanceof Error ? value.message : "Không tải được CRM");
      } finally {
        if (requestRef.current === controller) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [q, segment]);

  const stats = useMemo(() => ({
    total: data.length,
    vip: data.filter((customer) => customer.segment === "VIP").length,
    follow: data.filter((customer) => Boolean(customer.nextContactAt)).length,
    risk: data.filter((customer) => (customer.satisfaction || 5) <= 2 || customer._count.tickets > 0).length,
  }), [data]);

  return (
    <main className="min-h-screen">
      <OperationsHeader title="Khách hàng 360°" subtitle="Tìm trực tiếp trên dữ liệu hệ thống theo khách hàng, máy và Seri" />
      <div className="page-container space-y-6">
        {error && <Notice kind="error">{error}</Notice>}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Khách hàng" value={stats.total} icon="users" tone="emerald" />
          <MetricCard label="Khách VIP" value={stats.vip} icon="star" tone="violet" />
          <MetricCard label="Có lịch liên hệ" value={stats.follow} icon="phone" tone="amber" />
          <MetricCard label="Cần quan tâm" value={stats.risk} icon="alert" tone="rose" />
        </section>

        <section className="surface-card">
          <div className="data-toolbar">
            <div className="relative min-w-[260px] flex-1 max-w-2xl">
              <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Tìm tên, SĐT, địa chỉ, ID máy, Seri, model hoặc tên máy..."
                className="pl-10"
              />
            </div>
            <select value={segment} onChange={(event) => setSegment(event.target.value)} className="max-w-48">
              <option value="ALL">Tất cả phân khúc</option>
              <option value="STANDARD">Tiêu chuẩn</option>
              <option value="VIP">VIP</option>
              <option value="AT_RISK">Có nguy cơ</option>
              <option value="INTERNAL">Nội bộ</option>
            </select>
          </div>

          {loading ? <LoadingState label="Đang tìm trực tiếp trên dữ liệu khách hàng/máy..." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr>{["Khách hàng", "Phân khúc", "Thiết bị / Seri", "Tương tác", "Ticket", "CSKH phụ trách", "Liên hệ tiếp", "Đánh giá", ""].map((heading) => <th key={heading} className="p-3 text-left">{heading}</th>)}</tr></thead>
                <tbody>
                  {data.map((customer) => (
                    <tr key={customer.id}>
                      <td className="p-3"><strong>{customer.name}</strong><div><a href={`tel:${customer.phone}`} className="text-emerald-700">{customer.phone}</a></div><div className="max-w-xs truncate text-xs text-slate-500">{customer.address || "Chưa có địa chỉ"}</div></td>
                      <td className="p-3"><span className={`status-badge ${customer.segment === "VIP" ? "badge-violet" : customer.segment === "AT_RISK" ? "badge-rose" : "badge-slate"}`}>{customer.segment || "STANDARD"}</span></td>
                      <td className="p-3"><strong>{customer.machines.length}</strong>{customer.machines.slice(0, 3).map((machine) => <div key={machine.id} className="text-xs text-slate-500">{machine.id}{machine.serial ? ` · Seri ${machine.serial}` : ""} · {machine.name || machine.model}</div>)}</td>
                      <td className="p-3 font-bold">{customer._count.activities}</td>
                      <td className="p-3 font-bold">{customer._count.tickets}</td>
                      <td className="p-3">{customer.owner?.name || "Chưa giao"}</td>
                      <td className="p-3">{date(customer.nextContactAt)}</td>
                      <td className="p-3 font-black">{customer.satisfaction ? `${customer.satisfaction}/5` : "—"}</td>
                      <td className="p-3"><Link href={`/cskh/customers/${customer.id}`} className="icon-button" title="Mở hồ sơ"><Icon name="chevron-right" size={18} /></Link></td>
                    </tr>
                  ))}
                  {!data.length && <tr><td colSpan={9} className="p-10 text-center text-slate-500">Không tìm thấy khách hàng hoặc máy phù hợp.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
