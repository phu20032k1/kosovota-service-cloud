"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { ExecutiveReportDialog, type ExecutiveReportKey } from "@/components/ExecutiveReportDialog";

type StatusRow = { status: string; count: number };
type TrendRow = { key: string; label: string; created: number; completed: number; reports: number; revenue: number };
type Data = {
  kpis: Record<string, number>;
  careFunnel: {
    customerMachines: number;
    dueMachines: number;
    caredMachines: number;
    servedMachines: number;
    activeOrders: number;
    completedOrders: number;
  };
  orderStatuses: StatusRow[];
  ticketStatuses: StatusRow[];
  trend: TrendRow[];
  provinceRows: { provinceCode: string | null; _count: { _all: number } }[];
  lowStockRows: { id: string; quantity: number; item: { sku: string; name: string; minStock: number }; warehouse: { name: string } }[];
  topDealers: { id: string; dealerCode: string; name: string; rating?: number | null; completed: number; revenue: number }[];
  overdueSchedules: { id: string; title: string; dueDate: string; status: string; machineId: string; machineName: string; customerName: string | null; customerPhone: string | null }[];
};

const money = (value = 0) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const STATUS_LABEL: Record<string, string> = {
  NEW: "Mới tạo",
  ASSIGNED: "Đã phân công",
  ACCEPTED: "Đã nhận",
  IN_PROGRESS: "Đang thực hiện",
  WAITING_CUSTOMER: "Chờ khách hàng",
  RESOLVED: "Đã giải quyết",
  COMPLETED: "Hoàn thành",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
  REJECTED: "Từ chối",
};

function StatusBars({ rows, emptyLabel }: { rows: StatusRow[]; emptyLabel: string }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  if (!rows.length) return <div className="empty-state"><div><Icon name="check" size={28} className="mx-auto mb-2 text-emerald-600"/><p className="font-bold">{emptyLabel}</p></div></div>;
  return <div className="space-y-4 p-5">
    {rows.map((row) => <div key={row.status}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-extrabold text-slate-700">{STATUS_LABEL[row.status] || row.status}</span>
        <span className="rounded-lg bg-slate-100 px-2 py-1 font-black text-slate-900">{row.count}</span>
      </div>
      <div className="stat-bar"><span style={{ width: `${Math.max(5, row.count / max * 100)}%` }}/></div>
    </div>)}
  </div>;
}

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<ExecutiveReportKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/executive-dashboard", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được dashboard");
      setData(result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const change = useMemo(() => {
    if (!data) return 0;
    const previous = data.kpis.revenuePrev || 0;
    return previous ? Math.round(((data.kpis.revenueMonth - previous) / previous) * 100) : data.kpis.revenueMonth ? 100 : 0;
  }, [data]);

  const maxTrend = useMemo(() => Math.max(...(data?.trend || []).flatMap((row) => [row.created, row.completed, row.reports]), 1), [data]);

  return <main className="min-h-screen">
    <OperationsHeader title="Dashboard lãnh đạo" subtitle="Tổng quan vận hành, doanh thu, chăm sóc khách hàng, kho và chất lượng dịch vụ" actions={<button type="button" onClick={load} className="icon-button" title="Làm mới"><Icon name="refresh" size={18}/></button>} />
    <div className="page-container space-y-6">
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data ? <LoadingState label="Đang tổng hợp dữ liệu doanh nghiệp..." /> : data && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" onClick={() => setActiveReport("machines")} className="report-card-button" title="Xem danh sách máy"><MetricCard label="Máy khách đang sử dụng" value={data.kpis.machines} icon="droplet" tone="emerald" hint={`${data.kpis.customers} khách · ${data.kpis.totalMachines} máy toàn hệ thống · Bấm để xem`} /></button>
          <button type="button" onClick={() => setActiveReport("revenue")} className="report-card-button" title="Xem báo cáo doanh thu"><MetricCard label="Doanh thu tháng" value={money(data.kpis.revenueMonth)} icon="activity" tone="blue" hint={`${change >= 0 ? "+" : ""}${change}% so với tháng trước · Bấm để xem`} /></button>
          <button type="button" onClick={() => setActiveReport("overdue")} className="report-card-button" title="Xem lịch quá hạn"><MetricCard label="Lịch quá hạn" value={data.kpis.overdueSchedules} icon="calendar" tone="rose" hint={`${data.kpis.upcomingSchedules} lịch trong 30 ngày · Bấm để xem`} /></button>
          <button type="button" onClick={() => setActiveReport("tickets")} className="report-card-button" title="Xem ticket"><MetricCard label="Ticket đang mở" value={data.kpis.openTickets} icon="alert" tone="amber" hint={`${data.kpis.criticalTickets} ticket khẩn cấp · Bấm để xem`} /></button>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" onClick={() => setActiveReport("dealers")} className="report-card-button" title="Xem đại lý"><MetricCard label="Đại lý hoạt động" value={data.kpis.dealers} icon="store" tone="violet" hint="Bấm để xem chi tiết" /></button>
          <button type="button" onClick={() => setActiveReport("inventory")} className="report-card-button" title="Xem tồn kho"><MetricCard label="Giá trị tồn kho" value={money(data.kpis.inventoryValue)} icon="package" tone="emerald" hint="Bấm để xem chi tiết" /></button>
          <button type="button" onClick={() => setActiveReport("paid")} className="report-card-button" title="Xem thanh toán"><MetricCard label="Đã thanh toán" value={money(data.kpis.paid)} icon="check" tone="blue" hint="Bấm để xem chi tiết" /></button>
          <button type="button" onClick={() => setActiveReport("payable")} className="report-card-button" title="Xem công nợ"><MetricCard label="Công nợ chờ xử lý" value={money(data.kpis.payable)} icon="wallet" tone="amber" hint="Bấm để xem chi tiết" /></button>
        </section>

        <section className="surface-card overflow-hidden">
          <div className="data-toolbar">
            <div><p className="section-kicker">Hiệu quả chăm sóc khách hàng</p><h2 className="page-section-title">Từ máy đến kỳ chăm sóc đến dịch vụ đã hoàn thành</h2><p className="page-section-subtitle">Số liệu được tổng hợp trực tiếp từ lịch chăm sóc, lệnh điều phối và báo cáo dịch vụ.</p></div>
            <Link href="/admin/service-orders" className="btn-secondary"><Icon name="eye" size={16}/>Xem lệnh chi tiết</Link>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
            <Link href="/admin/machines" className="soft-card p-4 transition hover:-translate-y-0.5"><p className="text-xs font-bold text-slate-500">Máy khách đang dùng</p><p className="mt-2 text-3xl font-black text-slate-950">{data.careFunnel.customerMachines}</p></Link>
            <Link href="/admin/machines" className="soft-card p-4 transition hover:-translate-y-0.5"><p className="text-xs font-bold text-slate-500">Máy đến kỳ chăm sóc</p><p className="mt-2 text-3xl font-black text-amber-700">{data.careFunnel.dueMachines}</p></Link>
            <Link href="/admin/machines" className="soft-card p-4 transition hover:-translate-y-0.5"><p className="text-xs font-bold text-slate-500">Máy đã chăm sóc</p><p className="mt-2 text-3xl font-black text-emerald-700">{data.careFunnel.caredMachines}</p></Link>
            <Link href="/admin/service-orders" className="soft-card p-4 transition hover:-translate-y-0.5"><p className="text-xs font-bold text-slate-500">Máy đã có báo cáo DV</p><p className="mt-2 text-3xl font-black text-blue-700">{data.careFunnel.servedMachines}</p></Link>
            <Link href="/operations-map" className="soft-card p-4 transition hover:-translate-y-0.5"><p className="text-xs font-bold text-slate-500">Lệnh đang xử lý</p><p className="mt-2 text-3xl font-black text-violet-700">{data.careFunnel.activeOrders}</p></Link>
            <Link href="/admin/service-orders" className="soft-card p-4 transition hover:-translate-y-0.5"><p className="text-xs font-bold text-slate-500">Lệnh hoàn thành</p><p className="mt-2 text-3xl font-black text-emerald-700">{data.careFunnel.completedOrders}</p></Link>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(330px,.8fr)]">
          <article className="surface-card overflow-hidden">
            <div className="data-toolbar"><div><p className="section-kicker">Xu hướng 6 tháng</p><h2 className="page-section-title">Lệnh tạo mới, hoàn thành và báo cáo dịch vụ</h2><p className="page-section-subtitle">Biểu đồ trực quan giúp phát hiện tháng quá tải hoặc tỷ lệ hoàn thành thấp.</p></div><div className="flex flex-wrap gap-3 text-xs font-bold"><span className="mini-chip"><i className="h-2.5 w-2.5 rounded-full bg-slate-400"/>Lệnh tạo</span><span className="mini-chip"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500"/>Hoàn thành</span><span className="mini-chip"><i className="h-2.5 w-2.5 rounded-full bg-blue-500"/>Báo cáo DV</span></div></div>
            <div className="overflow-x-auto p-5">
              <div className="grid min-w-[620px] grid-cols-6 gap-4">
                {data.trend.map((row) => <div key={row.key} className="grid min-w-0 grid-rows-[190px_auto] gap-3">
                  <div className="flex items-end justify-center gap-1.5 rounded-2xl bg-slate-50 px-2 pt-4">
                    <div title={`${row.created} lệnh tạo`} className="w-5 rounded-t-lg bg-slate-400 transition-all" style={{ height: `${Math.max(4, row.created / maxTrend * 100)}%` }}/>
                    <div title={`${row.completed} lệnh hoàn thành`} className="w-5 rounded-t-lg bg-emerald-500 transition-all" style={{ height: `${Math.max(4, row.completed / maxTrend * 100)}%` }}/>
                    <div title={`${row.reports} báo cáo dịch vụ`} className="w-5 rounded-t-lg bg-blue-500 transition-all" style={{ height: `${Math.max(4, row.reports / maxTrend * 100)}%` }}/>
                  </div>
                  <div className="text-center"><p className="text-sm font-black">{row.label}</p><p className="mt-1 text-[11px] font-bold text-slate-500">{money(row.revenue)}</p></div>
                </div>)}
              </div>
            </div>
          </article>

          <article className="surface-card overflow-hidden">
            <div className="data-toolbar"><div><p className="section-kicker">Điều phối hiện tại</p><h2 className="page-section-title">Trạng thái lệnh dịch vụ</h2><p className="page-section-subtitle">Phân bổ tất cả lệnh theo trạng thái xử lý.</p></div><Link href="/operations-map" className="icon-button" title="Mở Điều phối"><Icon name="map" size={18}/></Link></div>
            <StatusBars rows={data.orderStatuses} emptyLabel="Chưa có lệnh dịch vụ"/>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <article className="surface-card xl:col-span-2">
            <div className="data-toolbar"><div><h2 className="page-section-title">Phân bổ máy theo tỉnh</h2><p className="page-section-subtitle">10 khu vực có số lượng thiết bị cao nhất</p></div><Link href="/customer-map" className="btn-secondary"><Icon name="map" size={16}/>Xem bản đồ</Link></div>
            <div className="space-y-4 p-5">{data.provinceRows.map((row) => { const max = Math.max(...data.provinceRows.map((item) => item._count._all), 1); return <div key={row.provinceCode || "unknown"}><div className="mb-1.5 flex justify-between text-sm"><span className="font-bold">Mã tỉnh {row.provinceCode || "Chưa xác định"}</span><span className="font-black">{row._count._all}</span></div><div className="stat-bar"><span style={{ width: `${Math.max(5, row._count._all / max * 100)}%` }}/></div></div>; })}{!data.provinceRows.length && <div className="empty-state"><p className="font-bold">Chưa có dữ liệu tỉnh/thành.</p></div>}</div>
          </article>
          <article className="surface-card">
            <div className="data-toolbar"><div><h2 className="page-section-title">Cảnh báo tồn kho</h2><p className="page-section-subtitle">Vật tư đang ở dưới ngưỡng tối thiểu</p></div><Link href="/admin/inventory" className="icon-button" title="Mở kho"><Icon name="chevron-right" size={18}/></Link></div>
            <div className="divide-y">{data.lowStockRows.slice(0, 8).map((row) => <div key={row.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-extrabold">{row.item.name}</p><p className="text-xs text-slate-500">{row.item.sku} · {row.warehouse.name}</p></div><span className="status-badge badge-rose">{row.quantity}/{row.item.minStock}</span></div>)}{!data.lowStockRows.length && <div className="empty-state"><div><Icon name="check" size={30} className="mx-auto mb-2 text-emerald-600"/><p className="font-bold">Tồn kho đang an toàn</p></div></div>}</div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <article className="surface-card overflow-hidden">
            <div className="data-toolbar"><div><h2 className="page-section-title">Trạng thái Ticket</h2><p className="page-section-subtitle">Yêu cầu khách hàng và mức độ tồn đọng.</p></div><Link href="/admin/tickets" className="icon-button" title="Mở Ticket"><Icon name="file" size={18}/></Link></div>
            <StatusBars rows={data.ticketStatuses} emptyLabel="Chưa có ticket"/>
          </article>
          <article className="surface-card">
            <div className="data-toolbar"><div><h2 className="page-section-title">Hiệu suất đại lý</h2><p className="page-section-subtitle">Xếp hạng theo chất lượng và số lệnh hoàn thành</p></div><Link href="/admin/payments" className="btn-secondary"><Icon name="wallet" size={16}/>Đối soát</Link></div>
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr><th className="p-3 text-left">Đại lý</th><th className="p-3 text-left">Rating</th><th className="p-3 text-left">Lệnh hoàn thành</th><th className="p-3 text-left">Doanh thu dịch vụ</th><th className="p-3 text-right">Chi tiết</th></tr></thead><tbody>{data.topDealers.map((dealer) => <tr key={dealer.id}><td className="p-3"><strong>{dealer.name}</strong><div className="text-xs text-slate-500">{dealer.dealerCode}</div></td><td className="p-3 font-black">{dealer.rating?.toFixed(1) || "—"}</td><td className="p-3 font-bold">{dealer.completed}</td><td className="p-3 font-black text-emerald-700">{money(dealer.revenue)}</td><td className="p-3 text-right"><Link href={`/admin/dealers/${dealer.id}`} className="btn-secondary whitespace-nowrap text-xs">Xem đại lý</Link></td></tr>)}{!data.topDealers.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Chưa có dữ liệu đại lý.</td></tr>}</tbody></table></div>
          </article>
        </section>
      </>}
    </div>
    <ExecutiveReportDialog report={activeReport} onClose={() => setActiveReport(null)} />
  </main>;
}
