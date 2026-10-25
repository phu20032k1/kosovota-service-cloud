"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { readApiResponse } from "@/lib/client-api";

type Period = 7 | 14 | 30;
type View = "users" | "conversations" | "revenue" | "calls" | "agents";

type DashboardData = {
  period: number;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  metrics: {
    tracked: number;
    due: number;
    dueTasks: number;
    cared: number;
    assigned: number;
    serviced: number;
    customersTotal: number;
    customersNew: number;
    conversations: number;
    messages: number;
    tickets: number;
    resolvedTickets: number;
    revenue: number;
    calls: number;
    answeredCalls: number;
    missedCalls: number;
  };
  trend: Array<{
    date: string;
    dueMachines: number;
    dueTasks: number;
    careActions: number;
    caredMachines: number;
    servicedMachines: number;
    serviceReports: number;
    newCustomers: number;
    conversations: number;
    messages: number;
    tickets: number;
    revenue: number;
    calls: number;
    answeredCalls: number;
  }>;
  hourly: Array<{ hour: number; calls: number; conversations: number }>;
  careOutcomes: Array<{ label: string; count: number }>;
  serviceTypes: Array<{ label: string; count: number }>;
  agents: Array<{
    id: string;
    name: string;
    phone: string;
    calls: number;
    conversations: number;
    machines: number;
    accepted: number;
    assigned: number;
    serviced: number;
    lastActivity: string | null;
  }>;
  capabilities: {
    hasTelephonyCallLog: boolean;
    callDefinition: string;
    revenueDefinition: string;
    conversationDefinition: string;
  };
};

function shortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00+07:00`));
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function money(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value || 0);
}

function percent(value: number, total: number) {
  return total ? Math.round((value * 100) / total) : 0;
}

function hourLabel(hour: number) {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

export default function CskhDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>(7);
  const [view, setView] = useState<View>("users");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/cskh/dashboard?period=${period}`, { cache: "no-store" });
      const result = await readApiResponse<DashboardData>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không tải được dữ liệu quản trị CSKH.");
      setData(result.data);
      setError("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được dữ liệu quản trị CSKH.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  if (loading && !data) {
    return <main className="min-h-screen bg-slate-100"><OperationsHeader title="Quản trị CSKH" subtitle="Thống kê vận hành chăm sóc khách hàng"/><div className="mx-auto max-w-7xl p-5"><LoadingState label="Đang tổng hợp dữ liệu quản trị..."/></div></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader
        title="Quản trị CSKH"
        subtitle="Thống kê người dùng, hội thoại, doanh số, cuộc gọi và hiệu suất agent"
        actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} className="btn-secondary"><Icon name="refresh" size={16}/>Tải lại</button><Link href="/cskh/report" className="btn-primary px-4 py-2 font-black text-white"><Icon name="file" size={16}/>Báo cáo 22 cột</Link></div>}
      />

      <div className="mx-auto max-w-[1760px] p-3 sm:p-4">
        {error && <div className="mb-3"><Notice kind="error">{error}</Notice></div>}
        <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="grid min-h-[700px] lg:grid-cols-[190px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
              <div className="p-2 text-[12px]">
                <SideButton active={view === "users"} label="Thống kê lượng người dùng" onClick={() => setView("users")}/>
                <SideButton active={view === "conversations"} label="Thống kê hội thoại" onClick={() => setView("conversations")}/>
                <SideButton active={view === "revenue"} label="Thống kê doanh số" onClick={() => setView("revenue")}/>
                <SideButton active={view === "calls"} label="Thống kê cuộc gọi" onClick={() => setView("calls")}/>
                <SideButton active={view === "agents"} label="Hiệu suất của agent" onClick={() => setView("agents")}/>
                <Link href="/cskh/report" className="mt-2 block border-t border-slate-200 px-2 py-3 font-bold text-slate-600 hover:text-emerald-700">Bảng chi tiết 22 cột</Link>
              </div>
            </aside>

            <div className="min-w-0 p-4 sm:p-5">
              <Header view={view} period={period} setPeriod={setPeriod} generatedAt={data?.generatedAt}/>
              {data && view === "users" && <UsersView data={data}/>} 
              {data && view === "conversations" && <ConversationsView data={data}/>} 
              {data && view === "revenue" && <RevenueView data={data}/>} 
              {data && view === "calls" && <CallsView data={data}/>} 
              {data && view === "agents" && <AgentsView data={data}/>} 
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Header({ view, period, setPeriod, generatedAt }: { view: View; period: Period; setPeriod: (value: Period) => void; generatedAt?: string }) {
  const titles: Record<View, string> = {
    users: "Thống kê lượng người dùng",
    conversations: "Thống kê hội thoại",
    revenue: "Thống kê doanh số",
    calls: "Thống kê cuộc gọi",
    agents: "Hiệu suất của agent",
  };
  return <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-black text-slate-900">{titles[view]}</h1><p className="mt-1 text-xs text-slate-500">Cập nhật gần nhất: {dateTime(generatedAt)}</p></div><label className="w-full max-w-[140px] text-xs font-bold text-slate-500"><span className="mb-1 block">Thời gian</span><select value={period} onChange={(event) => setPeriod(Number(event.target.value) as Period)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"><option value={7}>7 ngày</option><option value={14}>14 ngày</option><option value={30}>30 ngày</option></select></label></div>;
}

function UsersView({ data }: { data: DashboardData }) {
  return <div className="pt-5"><div className="grid gap-3 sm:grid-cols-4"><Metric label="Tổng khách hàng" value={data.metrics.customersTotal}/><Metric label="Khách mới trong kỳ" value={data.metrics.customersNew}/><Metric label="Máy đang theo dõi" value={data.metrics.tracked}/><Metric label="Máy đến kỳ CSKH" value={data.metrics.due}/></div><Panel className="mt-5" title="Biểu đồ lượng người dùng mới"><DailyBars trend={data.trend} valueKey="newCustomers" label="Khách mới"/></Panel><DailyTable trend={data.trend} columns={[['Khách mới','newCustomers'],['Máy đến kỳ','dueMachines'],['Lượt chăm sóc','careActions']]}/></div>;
}

function ConversationsView({ data }: { data: DashboardData }) {
  const resolvedRate = percent(data.metrics.resolvedTickets, data.metrics.tickets);
  return <div className="pt-5"><div className="grid gap-3 sm:grid-cols-4"><Metric label="Hội thoại" value={data.metrics.conversations}/><Metric label="Tin nhắn" value={data.metrics.messages}/><Metric label="Yêu cầu mới" value={data.metrics.tickets}/><Metric label="Tỷ lệ đã xử lý" value={`${resolvedRate}%`}/></div><Panel className="mt-5" title="Thống kê hội thoại theo ngày"><GroupedDaily trend={data.trend} series={[['Tin nhắn','messages','#7dd3fc'],['Yêu cầu','tickets','#fb923c']]}/></Panel><DailyTable trend={data.trend} columns={[['Hội thoại','conversations'],['Tin nhắn','messages'],['Yêu cầu','tickets']]}/></div>;
}

function RevenueView({ data }: { data: DashboardData }) {
  const avg = data.metrics.serviced ? Math.round(data.metrics.revenue / data.metrics.serviced) : 0;
  return <div className="pt-5"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Doanh số dịch vụ" value={money(data.metrics.revenue)}/><Metric label="Máy đã làm dịch vụ" value={data.metrics.serviced}/><Metric label="Bình quân / máy" value={money(avg)}/></div><Panel className="mt-5" title="Doanh số dịch vụ theo ngày" subtitle="Tổng serviceFee của các lệnh COMPLETED"><MoneyBars trend={data.trend}/></Panel><p className="mt-3 text-xs text-slate-500">Doanh số ở đây là phí dịch vụ đã ghi nhận trên lệnh hoàn tất; không cộng doanh thu bán máy/sản phẩm vì hệ thống hiện chưa có bảng sales-order riêng.</p></div>;
}

function CallsView({ data }: { data: DashboardData }) {
  const answeredRate = percent(data.metrics.answeredCalls, data.metrics.calls);
  return <div className="pt-5"><div className="grid gap-3 sm:grid-cols-4"><Metric label="Tổng cuộc gọi ghi nhận" value={data.metrics.calls}/><Metric label="Đã kết nối" value={data.metrics.answeredCalls}/><Metric label="Khó liên lạc" value={data.metrics.missedCalls}/><Metric label="Tỷ lệ kết nối" value={`${answeredRate}%`}/></div><Panel className="mt-5" title="Biểu đồ cuộc gọi được ghi nhận theo khung giờ" subtitle="Dựa trên thời điểm NVCSKH lưu kết quả chăm sóc"><HourlyBars data={data.hourly} field="calls"/></Panel>{!data.capabilities.hasTelephonyCallLog && <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><b>Chưa có CallLog thoại thật.</b> Hiện biểu đồ dùng các lượt CARE_RESULT làm mốc cuộc gọi. Vì database chưa lưu thời lượng thoại nên các chỉ số như “thời lượng gọi”, “phản hồi &lt;30 giây” chưa thể tính chính xác.</div>}<div className="mt-4"><DataList title="Kết quả cuộc gọi / chăm sóc" rows={data.careOutcomes}/></div></div>;
}

function AgentsView({ data }: { data: DashboardData }) {
  return <div className="pt-5"><Panel title="Biểu đồ hội thoại / cuộc gọi theo khung giờ"><GroupedHourly data={data.hourly}/></Panel><div className="mt-6 flex items-center justify-between"><div><h2 className="text-base font-black text-slate-900">Chi tiết từng agent</h2><p className="mt-1 text-xs text-slate-500">Tất cả tài khoản CSKH đang hoạt động.</p></div><Link href="/cskh/report" className="text-xs font-bold text-slate-500 underline">Xem chi tiết toàn bộ dữ liệu</Link></div><div className="mt-3 overflow-x-auto border border-slate-200"><table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-100 text-left text-xs text-slate-600"><tr><th className="p-3">Agent</th><th className="p-3 text-center">Cuộc gọi</th><th className="p-3 text-center">Hội thoại</th><th className="p-3 text-center">Máy xử lý</th><th className="p-3 text-center">Khách nhận DV</th><th className="p-3 text-center">Đã giao đại lý</th><th className="p-3 text-center">Hoàn tất DV</th><th className="p-3">Hoạt động gần nhất</th></tr></thead><tbody>{data.agents.length ? data.agents.map((agent) => <tr key={agent.id} className="border-t"><td className="p-3"><p className="font-black">{agent.name}</p><p className="text-xs text-slate-400">{agent.phone}</p></td><td className="p-3 text-center font-bold">{agent.calls}</td><td className="p-3 text-center">{agent.conversations}</td><td className="p-3 text-center">{agent.machines}</td><td className="p-3 text-center">{agent.accepted}</td><td className="p-3 text-center">{agent.assigned}</td><td className="p-3 text-center">{agent.serviced}</td><td className="p-3 text-slate-500">{dateTime(agent.lastActivity)}</td></tr>) : <tr><td colSpan={8} className="p-8 text-center text-slate-400">Chưa có agent CSKH.</td></tr>}</tbody></table></div></div>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="border border-slate-200 bg-white px-4 py-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>;
}

function Panel({ title, subtitle, className = "", children }: { title: string; subtitle?: string; className?: string; children: ReactNode }) {
  return <section className={`border border-slate-200 bg-white p-4 ${className}`}><h2 className="text-sm font-black text-slate-800">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}{children}</section>;
}

function SideButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`block w-full px-2 py-1.5 text-left transition ${active ? "bg-white font-black text-blue-600 underline" : "font-medium text-slate-600 hover:bg-white hover:text-slate-950"}`}>{label}</button>;
}

function DailyBars({ trend, valueKey, label }: { trend: DashboardData['trend']; valueKey: keyof DashboardData['trend'][number]; label: string }) {
  const values = trend.map((item) => Number(item[valueKey]) || 0); const max = Math.max(1, ...values);
  return <div className="mt-4 flex h-[310px] items-end gap-2 border-b border-slate-200 px-2">{trend.map((item) => { const value = Number(item[valueKey]) || 0; return <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center justify-end"><span className="mb-1 text-[9px] font-bold">{value || ''}</span><div className="w-full max-w-12 bg-sky-300" title={`${label}: ${value}`} style={{height:`${Math.max(value ? 7 : 1, value / max * 235)}px`}}/><span className="mt-2 text-[9px] text-slate-500">{shortDate(item.date)}</span></div>;})}</div>;
}

function GroupedDaily({ trend, series }: { trend: DashboardData['trend']; series: Array<[string, keyof DashboardData['trend'][number], string]> }) {
  const max = Math.max(1, ...trend.flatMap((item) => series.map(([, key]) => Number(item[key]) || 0)));
  return <><div className="mt-4 flex h-[310px] items-end gap-2 border-b border-slate-200 px-2">{trend.map((item) => <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center justify-end"><div className="flex h-[240px] w-full items-end justify-center gap-1">{series.map(([label,key,color]) => { const value = Number(item[key]) || 0; return <div key={label} className="flex h-full flex-1 items-end"><div className="w-full" title={`${label}: ${value}`} style={{height:`${Math.max(value ? 7 : 1, value / max * 220)}px`,backgroundColor:color}}/></div>;})}</div><span className="mt-2 text-[9px] text-slate-500">{shortDate(item.date)}</span></div>)}</div><div className="mt-3 flex justify-center gap-5 text-xs">{series.map(([label,,color]) => <span key={label} className="inline-flex items-center gap-1"><i className="h-2 w-2" style={{backgroundColor:color}}/>{label}</span>)}</div></>;
}

function MoneyBars({ trend }: { trend: DashboardData['trend'] }) {
  const max = Math.max(1, ...trend.map((item) => item.revenue));
  return <div className="mt-4 flex h-[310px] items-end gap-2 border-b border-slate-200 px-2">{trend.map((item) => <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center justify-end"><span className="mb-1 text-[8px] font-bold text-slate-600">{item.revenue ? new Intl.NumberFormat('vi-VN',{notation:'compact'}).format(item.revenue) : ''}</span><div className="w-full max-w-12 bg-emerald-400" title={money(item.revenue)} style={{height:`${Math.max(item.revenue ? 7 : 1, item.revenue / max * 230)}px`}}/><span className="mt-2 text-[9px] text-slate-500">{shortDate(item.date)}</span></div>)}</div>;
}

function HourlyBars({ data, field }: { data: DashboardData['hourly']; field: 'calls' | 'conversations' }) {
  const max = Math.max(1, ...data.map((item) => item[field]));
  return <div className="mt-4 flex h-[310px] items-end gap-1 border-b border-slate-200 px-2">{data.map((item) => { const value = item[field]; return <div key={item.hour} className="flex min-w-0 flex-1 flex-col items-center justify-end"><span className="mb-1 text-[8px] font-bold">{value || ''}</span><div className="w-full max-w-9 bg-sky-300" style={{height:`${Math.max(value ? 7 : 1, value / max * 230)}px`}}/><span className="mt-2 text-[8px] text-slate-500">{hourLabel(item.hour)}</span></div>;})}</div>;
}

function GroupedHourly({ data }: { data: DashboardData['hourly'] }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.calls, item.conversations]));
  return <><div className="mt-4 flex h-[310px] items-end gap-1 border-b border-slate-200 px-2">{data.map((item) => <div key={item.hour} className="flex min-w-0 flex-1 flex-col items-center justify-end"><div className="flex h-[235px] w-full items-end gap-[1px]"><div className="flex-1 bg-sky-300" title={`Cuộc gọi: ${item.calls}`} style={{height:`${Math.max(item.calls ? 6 : 1, item.calls / max * 220)}px`}}/><div className="flex-1 bg-orange-300" title={`Hội thoại: ${item.conversations}`} style={{height:`${Math.max(item.conversations ? 6 : 1, item.conversations / max * 220)}px`}}/></div><span className="mt-2 text-[8px] text-slate-500">{hourLabel(item.hour)}</span></div>)}</div><div className="mt-3 flex justify-center gap-5 text-xs"><span className="inline-flex items-center gap-1"><i className="h-2 w-2 bg-sky-300"/>Cuộc gọi</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 bg-orange-300"/>Hội thoại</span></div></>;
}

function DailyTable({ trend, columns }: { trend: DashboardData['trend']; columns: Array<[string, keyof DashboardData['trend'][number]]> }) {
  return <div className="mt-4 overflow-x-auto border border-slate-200"><table className="w-full min-w-[650px] text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-left">Ngày</th>{columns.map(([label]) => <th key={label} className="p-3 text-center">{label}</th>)}</tr></thead><tbody>{trend.map((item) => <tr key={item.date} className="border-t"><td className="p-3 font-bold">{shortDate(item.date)}</td>{columns.map(([label,key]) => <td key={label} className="p-3 text-center">{String(item[key] ?? 0)}</td>)}</tr>)}</tbody></table></div>;
}

function DataList({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  return <section className="border border-slate-200"><div className="border-b bg-slate-50 px-4 py-3 text-sm font-black">{title}</div>{rows.length ? rows.slice(0,10).map((row) => <div key={row.label} className="flex justify-between border-b px-4 py-2 text-sm last:border-b-0"><span>{row.label}</span><b>{row.count}</b></div>) : <p className="p-5 text-center text-sm text-slate-400">Chưa có dữ liệu trong khoảng thời gian này.</p>}</section>;
}
