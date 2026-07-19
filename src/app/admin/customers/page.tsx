"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ImportCustomersButton from "@/components/ImportCustomersButton";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { readApiResponse } from "@/lib/client-api";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  segment?: string | null;
  satisfaction?: number | null;
  nextContactAt?: string | null;
  owner?: { name: string } | null;
  machines: { id: string; model: string; name?: string | null; status: string }[];
  _count: { activities: number; tickets: number };
};

type CustomerData = { customers: Customer[] };
type CareFilter = "ALL" | "VIP" | "FOLLOW" | "RISK";

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(value))
    : "—";

export default function CustomersPage() {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState("ALL");
  const [careFilter, setCareFilter] = useState<CareFilter>("ALL");
  const detailRef = useRef<HTMLElement | null>(null);
  const pendingDetailScroll = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (segment !== "ALL") params.set("segment", segment);
      const response = await fetch(`/api/crm/customers?${params}`, { cache: "no-store" });
      const result = await readApiResponse<CustomerData>(response);
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "Không tải được CRM");
      }
      setData(result.data.customers || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được CRM");
    } finally {
      setLoading(false);
    }
  }, [q, segment]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const isRisk = useCallback(
    (customer: Customer) => (customer.satisfaction || 5) <= 2 || customer._count.tickets > 0,
    [],
  );

  const stats = useMemo(
    () => ({
      total: data.length,
      vip: data.filter((customer) => customer.segment === "VIP").length,
      follow: data.filter((customer) => Boolean(customer.nextContactAt)).length,
      risk: data.filter(isRisk).length,
    }),
    [data, isRisk],
  );

  const visible = useMemo(
    () =>
      data.filter((customer) => {
        if (careFilter === "VIP") return customer.segment === "VIP";
        if (careFilter === "FOLLOW") return Boolean(customer.nextContactAt);
        if (careFilter === "RISK") return isRisk(customer);
        return true;
      }),
    [careFilter, data, isRisk],
  );

  function activateCareFilter(next: CareFilter) {
    if (careFilter === next) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    pendingDetailScroll.current = true;
    setCareFilter(next);
  }

  useEffect(() => {
    if (!pendingDetailScroll.current) return;
    pendingDetailScroll.current = false;
    const frame = window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [careFilter]);

  const filterLabel =
    careFilter === "ALL"
      ? "Tất cả"
      : careFilter === "VIP"
        ? "Khách VIP"
        : careFilter === "FOLLOW"
          ? "Có lịch liên hệ"
          : "Cần quan tâm";

  return (
    <main className="min-h-screen">
      <OperationsHeader
        title="Khách hàng 360°"
        subtitle="Một hồ sơ thống nhất cho máy, chăm sóc, dịch vụ và khiếu nại"
      />
      <div className="page-container space-y-6">
        {error && <Notice kind="error">{error}</Notice>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            aria-pressed={careFilter === "ALL"}
            onClick={() => activateCareFilter("ALL")}
            className={`report-card-button ${careFilter === "ALL" ? "ring-2 ring-emerald-500 ring-offset-2" : ""}`}
          >
            <MetricCard label="Khách hàng" value={stats.total} icon="users" tone="emerald" hint="Bấm để xem tất cả" />
          </button>
          <button
            type="button"
            aria-pressed={careFilter === "VIP"}
            onClick={() => activateCareFilter("VIP")}
            className={`report-card-button ${careFilter === "VIP" ? "ring-2 ring-violet-500 ring-offset-2" : ""}`}
          >
            <MetricCard label="Khách VIP" value={stats.vip} icon="star" tone="violet" hint="Bấm để lọc chi tiết" />
          </button>
          <button
            type="button"
            aria-pressed={careFilter === "FOLLOW"}
            onClick={() => activateCareFilter("FOLLOW")}
            className={`report-card-button ${careFilter === "FOLLOW" ? "ring-2 ring-amber-500 ring-offset-2" : ""}`}
          >
            <MetricCard label="Có lịch liên hệ" value={stats.follow} icon="phone" tone="amber" hint="Bấm để xem lịch và gọi khách" />
          </button>
          <button
            type="button"
            aria-pressed={careFilter === "RISK"}
            onClick={() => activateCareFilter("RISK")}
            className={`report-card-button ${careFilter === "RISK" ? "ring-2 ring-rose-500 ring-offset-2" : ""}`}
          >
            <MetricCard label="Cần quan tâm" value={stats.risk} icon="alert" tone="rose" hint="Bấm để xem hồ sơ cần xử lý" />
          </button>
        </section>

        <ImportCustomersButton onComplete={load} />

        {(careFilter === "FOLLOW" || careFilter === "RISK") && (
          <section ref={detailRef} className="surface-card overflow-hidden scroll-mt-28">
            <div className="data-toolbar">
              <div>
                <p className="section-kicker">Danh sách xử lý nhanh</p>
                <h2 className="page-section-title">
                  {careFilter === "FOLLOW" ? "Khách hàng có lịch liên hệ" : "Khách hàng cần quan tâm"}
                </h2>
                <p className="page-section-subtitle">
                  {careFilter === "FOLLOW"
                    ? "Xem ngày liên hệ, gọi ngay hoặc mở hồ sơ để ghi nhận kết quả chăm sóc."
                    : "Ưu tiên hồ sơ có đánh giá thấp hoặc đang có Ticket cần kiểm tra."}
                </p>
              </div>
              <button type="button" onClick={() => setCareFilter("ALL")} className="btn-secondary px-4 py-2 text-sm font-bold">
                <Icon name="x" size={16} /> Bỏ lọc
              </button>
            </div>
            {loading ? (
              <LoadingState label="Đang tải danh sách cần xử lý..." />
            ) : visible.length ? (
              <div className="grid max-h-[520px] gap-3 overflow-y-auto p-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((customer) => (
                  <article key={customer.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words font-black text-slate-950">{customer.name}</h3>
                        <a href={`tel:${customer.phone}`} className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
                          <Icon name="phone" size={14} /> {customer.phone}
                        </a>
                      </div>
                      <span className={`status-badge ${careFilter === "RISK" ? "badge-rose" : "badge-amber"}`}>
                        {careFilter === "RISK" ? "Cần xử lý" : date(customer.nextContactAt)}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{customer.address || "Chưa có địa chỉ"}</p>
                    <div className="mt-3 grid gap-1 text-xs text-slate-500">
                      <span><strong>{customer.machines.length}</strong> máy đang liên kết</span>
                      {careFilter === "FOLLOW" ? (
                        <span>Lịch liên hệ tiếp: <strong>{date(customer.nextContactAt)}</strong></span>
                      ) : (
                        <span>
                          {customer.satisfaction && customer.satisfaction <= 2
                            ? `Đánh giá thấp: ${customer.satisfaction}/5`
                            : `${customer._count.tickets} Ticket cần kiểm tra`}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={`tel:${customer.phone}`} className="btn-primary px-3 py-2 text-xs font-black text-white">
                        <Icon name="phone" size={15} /> Gọi khách
                      </a>
                      <Link href={`/admin/customers/${customer.id}`} className="btn-secondary px-3 py-2 text-xs font-black">
                        <Icon name="eye" size={15} /> Xem hồ sơ
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-detail-state m-4">
                <Icon name={careFilter === "FOLLOW" ? "phone" : "check"} size={30} />
                <strong>{careFilter === "FOLLOW" ? "Chưa có lịch liên hệ" : "Không có hồ sơ cần quan tâm"}</strong>
                <p>Dữ liệu sẽ xuất hiện tại đây ngay khi hồ sơ có lịch chăm sóc, Ticket hoặc đánh giá cần xử lý.</p>
              </div>
            )}
          </section>
        )}

        <section ref={careFilter === "FOLLOW" || careFilter === "RISK" ? undefined : detailRef} className="surface-card scroll-mt-28">
          <div className="data-toolbar">
            <div className="min-w-0 flex-1">
              <div className="relative min-w-[240px] max-w-xl">
                <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
                <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm tên, số điện thoại hoặc địa chỉ" className="pl-10" />
              </div>
              <p className="mt-2 text-xs font-bold text-slate-500">
                Đang hiển thị {visible.length}/{data.length} khách · Bộ lọc nhanh: {filterLabel}
              </p>
            </div>
            <select value={segment} onChange={(event) => setSegment(event.target.value)} className="max-w-48">
              <option value="ALL">Tất cả phân khúc</option>
              <option value="STANDARD">Tiêu chuẩn</option>
              <option value="VIP">VIP</option>
              <option value="AT_RISK">Có nguy cơ</option>
              <option value="INTERNAL">Nội bộ</option>
            </select>
          </div>

          {loading ? (
            <LoadingState label="Đang tìm khách hàng..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    {["Khách hàng", "Phân khúc", "Thiết bị", "Tương tác", "Ticket", "CSKH phụ trách", "Liên hệ tiếp", "Đánh giá", ""].map((header) => (
                      <th key={header} className="p-3 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((customer) => (
                    <tr key={customer.id}>
                      <td className="p-3">
                        <strong>{customer.name}</strong>
                        <div><a href={`tel:${customer.phone}`} className="text-emerald-700">{customer.phone}</a></div>
                        <div className="max-w-xs truncate text-xs text-slate-500">{customer.address || "Chưa có địa chỉ"}</div>
                      </td>
                      <td className="p-3">
                        <span className={`status-badge ${customer.segment === "VIP" ? "badge-violet" : customer.segment === "AT_RISK" ? "badge-rose" : "badge-slate"}`}>
                          {customer.segment || "STANDARD"}
                        </span>
                      </td>
                      <td className="p-3">
                        <strong>{customer.machines.length}</strong>
                        <div className="max-w-64 text-xs text-slate-500">
                          {customer.machines.slice(0, 3).map((machine) => machine.name || machine.model || machine.id).join(", ")}
                        </div>
                      </td>
                      <td className="p-3 font-bold">{customer._count.activities}</td>
                      <td className="p-3 font-bold">{customer._count.tickets}</td>
                      <td className="p-3">{customer.owner?.name || "Chưa giao"}</td>
                      <td className="p-3">{date(customer.nextContactAt)}</td>
                      <td className="p-3 font-black">{customer.satisfaction ? `${customer.satisfaction}/5` : "—"}</td>
                      <td className="p-3">
                        <Link href={`/admin/customers/${customer.id}`} className="icon-button" title="Mở hồ sơ">
                          <Icon name="chevron-right" size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!visible.length && (
                    <tr><td colSpan={9} className="p-10 text-center text-slate-500">Không tìm thấy khách hàng phù hợp với bộ lọc.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
