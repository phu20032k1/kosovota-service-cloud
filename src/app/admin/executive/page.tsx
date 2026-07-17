"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { ExecutiveReportDialog, type ExecutiveReportKey } from "@/components/ExecutiveReportDialog";

type Data = {
  kpis: Record<string, number>;
  provinceRows: { provinceCode: string | null; _count: { _all: number } }[];
  lowStockRows: { id: string; quantity: number; item: { sku: string; name: string; minStock: number }; warehouse: { name: string } }[];
  topDealers: { id: string; dealerCode: string; name: string; rating?: number | null; completed: number; revenue: number }[];
  overdueSchedules: { id: string; title: string; dueDate: string; status: string; machineId: string; machineName: string; customerName: string | null; customerPhone: string | null }[];
};

const money = (value = 0) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<ExecutiveReportKey | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/executive-dashboard", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được dashboard");
      setData(result.data);
    } catch (e) { setError(e instanceof Error ? e.message : "Không tải được dashboard"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const change = useMemo(() => {
    if (!data) return 0;
    const prev = data.kpis.revenuePrev || 0;
    return prev ? Math.round(((data.kpis.revenueMonth - prev) / prev) * 100) : data.kpis.revenueMonth ? 100 : 0;
  }, [data]);

  return <main className="min-h-screen">
    <OperationsHeader title="Dashboard lãnh đạo" subtitle="Tổng quan vận hành, doanh thu, bảo trì, kho và chất lượng dịch vụ" actions={<button type="button" onClick={load} className="icon-button" title="Làm mới"><Icon name="refresh" size={18}/></button>} />
    <div className="page-container space-y-6">
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data ? <LoadingState label="Đang tổng hợp dữ liệu doanh nghiệp..." /> : data && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" onClick={() => setActiveReport("machines")} className="report-card-button" title="Xem danh sách máy"><MetricCard label="Máy khách đang sử dụng" value={data.kpis.machines} icon="droplet" tone="emerald" hint={`${data.kpis.customers} khách · ${data.kpis.totalMachines} máy toàn hệ thống · Bấm để xem`} /></button>
          <button type="button" onClick={() => setActiveReport("revenue")} className="report-card-button" title="Xem báo cáo doanh thu"><MetricCard label="Doanh thu tháng" value={money(data.kpis.revenueMonth)} icon="activity" tone="blue" hint={`${change >= 0 ? "+" : ""}${change}% so với tháng trước · Bấm để xem`} /></button>
          <button type="button" onClick={() => setActiveReport("overdue")} className="report-card-button" title="Xem lịch quá hạn">
            <MetricCard label="Lịch quá hạn" value={data.kpis.overdueSchedules} icon="calendar" tone="rose" hint={`${data.kpis.upcomingSchedules} lịch trong 30 ngày · Bấm để xem`} />
          </button>
          <button type="button" onClick={() => setActiveReport("tickets")} className="report-card-button" title="Xem ticket"><MetricCard label="Ticket đang mở" value={data.kpis.openTickets} icon="alert" tone="amber" hint={`${data.kpis.criticalTickets} ticket khẩn cấp · Bấm để xem`} /></button>
        </section>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" onClick={() => setActiveReport("dealers")} className="report-card-button" title="Xem đại lý"><MetricCard label="Đại lý hoạt động" value={data.kpis.dealers} icon="store" tone="violet" hint="Bấm để xem chi tiết" /></button>
          <button type="button" onClick={() => setActiveReport("inventory")} className="report-card-button" title="Xem tồn kho"><MetricCard label="Giá trị tồn kho" value={money(data.kpis.inventoryValue)} icon="package" tone="emerald" hint="Bấm để xem chi tiết" /></button>
          <button type="button" onClick={() => setActiveReport("paid")} className="report-card-button" title="Xem thanh toán"><MetricCard label="Đã thanh toán" value={money(data.kpis.paid)} icon="check" tone="blue" hint="Bấm để xem chi tiết" /></button>
          <button type="button" onClick={() => setActiveReport("payable")} className="report-card-button" title="Xem công nợ"><MetricCard label="Công nợ chờ xử lý" value={money(data.kpis.payable)} icon="wallet" tone="amber" hint="Bấm để xem chi tiết" /></button>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <article className="surface-card xl:col-span-2">
            <div className="data-toolbar"><div><h2 className="page-section-title">Phân bổ máy theo tỉnh</h2><p className="page-section-subtitle">10 khu vực có số lượng thiết bị cao nhất</p></div><Link href="/customer-map" className="btn-secondary"><Icon name="map" size={16}/>Xem bản đồ</Link></div>
            <div className="space-y-4 p-5">{data.provinceRows.map((row) => { const max = Math.max(...data.provinceRows.map((r) => r._count._all), 1); return <div key={row.provinceCode || "unknown"}><div className="mb-1.5 flex justify-between text-sm"><span className="font-bold">Mã tỉnh {row.provinceCode || "Chưa xác định"}</span><span className="font-black">{row._count._all}</span></div><div className="stat-bar"><span style={{ width: `${Math.max(5, row._count._all / max * 100)}%` }}/></div></div>; })}</div>
          </article>
          <article className="surface-card">
            <div className="data-toolbar"><div><h2 className="page-section-title">Cảnh báo tồn kho</h2><p className="page-section-subtitle">Vật tư đang ở dưới ngưỡng tối thiểu</p></div><Link href="/admin/inventory" className="icon-button" title="Mở kho"><Icon name="chevron-right" size={18}/></Link></div>
            <div className="divide-y">{data.lowStockRows.slice(0, 8).map((row) => <div key={row.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-extrabold">{row.item.name}</p><p className="text-xs text-slate-500">{row.item.sku} · {row.warehouse.name}</p></div><span className="status-badge badge-rose">{row.quantity}/{row.item.minStock}</span></div>)}{!data.lowStockRows.length && <div className="empty-state"><div><Icon name="check" size={30} className="mx-auto mb-2 text-emerald-600"/><p className="font-bold">Tồn kho đang an toàn</p></div></div>}</div>
          </article>
        </section>

        <section className="surface-card">
          <div className="data-toolbar"><div><h2 className="page-section-title">Hiệu suất đại lý</h2><p className="page-section-subtitle">Xếp hạng theo chất lượng và số lệnh hoàn thành</p></div><Link href="/admin/payments" className="btn-secondary"><Icon name="wallet" size={16}/>Đối soát</Link></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr><th className="p-3 text-left">Đại lý</th><th className="p-3 text-left">Rating</th><th className="p-3 text-left">Lệnh hoàn thành</th><th className="p-3 text-left">Doanh thu dịch vụ</th></tr></thead><tbody>{data.topDealers.map((dealer) => <tr key={dealer.id}><td className="p-3"><strong>{dealer.name}</strong><div className="text-xs text-slate-500">{dealer.dealerCode}</div></td><td className="p-3 font-black">{dealer.rating?.toFixed(1) || "—"}</td><td className="p-3 font-bold">{dealer.completed}</td><td className="p-3 font-black text-emerald-700">{money(dealer.revenue)}</td></tr>)}</tbody></table></div>
        </section>
      </>}
    </div>
    <ExecutiveReportDialog report={activeReport} onClose={() => setActiveReport(null)} />
  </main>;
}
