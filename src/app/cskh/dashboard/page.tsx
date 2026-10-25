"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { readApiResponse } from "@/lib/client-api";

type ReportRow = {
  id: string;
  date: string | null;
  machineId: string;
  machineCode: string;
  customerName: string;
  cskhName: string;
  currentCareResult: string;
  dealerCode: string;
  status: string;
  reportCount: number;
  updatedAt: string;
};

type ReportData = {
  rows: ReportRow[];
  metrics: { total: number; due: number; cared: number; serviced: number; assigned: number };
  generatedAt: string;
};

type Period = 7 | 14 | 30;
type View = "overview" | "volume" | "revenue" | "performance" | "agents";

const CARED = new Set(["CALLED_NO_ANSWER", "CUSTOMER_ACCEPTED", "CUSTOMER_SELF_SERVICE", "CUSTOMER_INTERNAL", "CUSTOMER_REJECTED", "RESCHEDULED", "COMPLAINT", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"]);

function dayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function isoDate(value?: string | null) { return value ? value.slice(0, 10) : ""; }
function shortDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`)); }
function dateTime(value?: string | null) { return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—"; }
function wasCared(row: ReportRow) { return Boolean(row.currentCareResult) || CARED.has(row.status); }
function wasServiced(row: ReportRow) { return row.reportCount > 0 || row.status === "COMPLETED"; }

export default function CskhDashboardPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>(7);
  const [view, setView] = useState<View>("performance");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/cskh/report", { cache: "no-store" });
      const result = await readApiResponse<ReportData>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không tải được dữ liệu quản trị.");
      setData(result.data); setError("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được dữ liệu quản trị.");
    } finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  const metrics = data?.metrics || { total: 0, due: 0, cared: 0, serviced: 0, assigned: 0 };
  const uncared = Math.max(0, metrics.due - metrics.cared);
  const careRate = metrics.due ? Math.round(metrics.cared * 100 / metrics.due) : 0;
  const serviceRate = metrics.cared ? Math.round(metrics.serviced * 100 / metrics.cared) : 0;

  const trend = useMemo(() => {
    const rows = data?.rows || []; const today = new Date(); today.setHours(0, 0, 0, 0);
    return Array.from({ length: period }, (_, index) => {
      const d = new Date(today); d.setDate(d.getDate() - (period - 1 - index)); const key = dayKey(d);
      const due = rows.filter(r => isoDate(r.date) === key);
      const changed = rows.filter(r => isoDate(r.updatedAt) === key);
      return { key, due: new Set(due.map(r => r.machineId)).size, cared: new Set(changed.filter(wasCared).map(r => r.machineId)).size, serviced: new Set(changed.filter(wasServiced).map(r => r.machineId)).size };
    });
  }, [data, period]);

  const hourly = useMemo(() => {
    const rows = data?.rows || [];
    return Array.from({ length: 24 }, (_, hour) => ({ hour, value: new Set(rows.filter(r => wasCared(r) && new Date(r.updatedAt).getHours() === hour).map(r => r.id)).size }));
  }, [data]);

  const agents = useMemo(() => {
    const groups = new Map<string, ReportRow[]>();
    for (const row of data?.rows || []) { const name = row.cskhName?.trim() || "Chưa ghi nhận NVCSKH"; groups.set(name, [...(groups.get(name) || []), row]); }
    return [...groups.entries()].map(([name, rows]) => {
      const due = new Set(rows.map(r => r.machineId)).size;
      const cared = new Set(rows.filter(wasCared).map(r => r.machineId)).size;
      const assigned = new Set(rows.filter(r => Boolean(r.dealerCode)).map(r => r.machineId)).size;
      const serviced = new Set(rows.filter(wasServiced).map(r => r.machineId)).size;
      return { name, due, cared, assigned, serviced, rate: due ? Math.round(cared * 100 / due) : 0 };
    }).sort((a,b) => b.cared - a.cared || b.serviced - a.serviced);
  }, [data]);

  if (loading && !data) return <main className="min-h-screen bg-slate-100"><OperationsHeader title="Quản trị CSKH" subtitle="Thống kê chăm sóc khách hàng"/><div className="mx-auto max-w-7xl p-5"><LoadingState label="Đang tải dữ liệu quản trị..."/></div></main>;

  return <main className="min-h-screen bg-slate-100">
    <OperationsHeader title="Quản trị CSKH" subtitle="Thống kê hiệu quả chăm sóc khách hàng toàn quốc" actions={<div className="flex gap-2"><button type="button" onClick={() => void load()} className="btn-secondary"><Icon name="refresh" size={16}/>Tải lại</button><Link href="/cskh/report" className="btn-primary px-4 py-2 font-black text-white"><Icon name="file" size={16}/>Báo cáo 22 cột</Link></div>}/>
    <div className="mx-auto max-w-[1760px] p-3 sm:p-4">
      {error && <div className="mb-3"><Notice kind="error">{error}</Notice></div>}
      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="grid min-h-[650px] lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
            <div className="p-2">
              <Nav label="Thống kê lượng máy đến kỳ" active={view === "volume"} onClick={() => setView("volume")}/>
              <Nav label="Thống kê chăm sóc" active={view === "overview"} onClick={() => setView("overview")}/>
              <Nav label="Thống kê dịch vụ" active={view === "revenue"} onClick={() => setView("revenue")}/>
              <Nav label="Thống kê cuộc gọi" active={view === "performance"} onClick={() => setView("performance")}/>
              <Nav label="Hiệu suất của agent" active={view === "agents"} onClick={() => setView("agents")}/>
            </div>
          </aside>

          <div className="min-w-0 p-4 sm:p-6">
            {view === "agents" ? <AgentView hourly={hourly} agents={agents}/> : <OverviewView view={view} period={period} setPeriod={setPeriod} trend={trend} metrics={metrics} uncared={uncared} careRate={careRate} serviceRate={serviceRate} generatedAt={data?.generatedAt}/>} 
          </div>
        </div>
      </section>
    </div>
  </main>;
}

function OverviewView({ view, period, setPeriod, trend, metrics, uncared, careRate, serviceRate, generatedAt }: { view: View; period: Period; setPeriod: (p: Period) => void; trend: {key:string;due:number;cared:number;serviced:number}[]; metrics: ReportData["metrics"]; uncared:number; careRate:number; serviceRate:number; generatedAt?:string }) {
  const title = view === "volume" ? "Thống kê lượng máy đến kỳ" : view === "revenue" ? "Thống kê dịch vụ" : view === "overview" ? "Thống kê chăm sóc" : "Thống kê hội thoại";
  const max = Math.max(1, ...trend.flatMap(x => [x.due, x.cared, x.serviced]));
  return <>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-xl font-black text-slate-900">{title}</h1><p className="mt-1 text-xs text-slate-500">Cập nhật gần nhất {dateTime(generatedAt)}</p></div>
      <div className="flex items-end gap-3"><label className="text-xs font-bold text-slate-500"><span className="mb-1 block">Thời gian</span><select value={period} onChange={e => setPeriod(Number(e.target.value) as Period)} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"><option value={7}>7 ngày</option><option value={14}>14 ngày</option><option value={30}>30 ngày</option></select></label><Link href="/cskh/report" className="rounded border border-slate-300 px-3 py-2 text-sm font-bold text-emerald-700">Danh sách chi tiết</Link></div>
    </div>

    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <TopMetric value={metrics.due} label="Tổng số máy đến kỳ" note={`${uncared} chưa chăm sóc`}/>
      <TopMetric value={metrics.cared} label="Máy đã chăm sóc" note={`${careRate}% số máy đến kỳ`}/>
      <TopMetric value={metrics.serviced} label="Đã thực hiện dịch vụ" note={`${serviceRate}% số máy đã chăm sóc`}/>
    </div>

    <div className="mt-7"><h2 className="text-sm font-black text-slate-700">Hiệu quả chăm sóc theo ngày</h2><div className="mt-3 flex h-64 items-end gap-2 border-b border-slate-300 px-2 pt-4 sm:gap-4">{trend.map(item => <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center"><div className="flex h-52 w-full items-end justify-center gap-1"><Bar value={item.due} max={max} cls="bg-orange-400"/><Bar value={item.cared} max={max} cls="bg-sky-400"/><Bar value={item.serviced} max={max} cls="bg-emerald-500"/></div><span className="mt-2 text-[10px] font-semibold text-slate-500">{shortDate(item.key)}</span></div>)}</div><div className="mt-3 flex justify-center gap-5 text-xs font-bold text-slate-600"><Legend dot="bg-orange-400" text="Máy đến kỳ"/><Legend dot="bg-sky-400" text="Đã chăm sóc"/><Legend dot="bg-emerald-500" text="Đã làm dịch vụ"/></div></div>

    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <SimpleTable title="Theo trạng thái" rows={[["Chưa chăm sóc", uncared], ["Đã chăm sóc", metrics.cared], ["Đã giao đại lý", metrics.assigned], ["Đã hoàn tất dịch vụ", metrics.serviced]]}/>
      <SimpleTable title="Tỷ lệ xử lý" rows={[["Tỷ lệ chăm sóc", `${careRate}%`], ["Tỷ lệ hoàn tất dịch vụ", `${serviceRate}%`], ["Tổng máy theo dõi", metrics.total], ["Tổng máy đến kỳ", metrics.due]]}/>
    </div>
  </>;
}

function AgentView({ hourly, agents }: { hourly:{hour:number;value:number}[]; agents:{name:string;due:number;cared:number;assigned:number;serviced:number;rate:number}[] }) {
  const max = Math.max(1, ...hourly.map(x => x.value));
  return <><h1 className="text-xl font-black text-slate-900">Biểu đồ hội thoại được trả lời theo khung giờ</h1><div className="mt-5 flex h-64 items-end gap-1 border-b border-slate-300 px-2">{hourly.map(x => <div key={x.hour} className="flex min-w-0 flex-1 flex-col items-center justify-end"><div title={`${x.value} lượt`} className="w-full max-w-8 bg-sky-300" style={{height:`${Math.max(x.value ? 8 : 1, x.value/max*190)}px`}}/><span className="mt-2 text-[9px] text-slate-500">{x.hour === 0 ? "12am" : x.hour < 12 ? `${x.hour}am` : x.hour === 12 ? "12pm" : `${x.hour-12}pm`}</span></div>)}</div><div className="mt-8 flex items-center justify-between"><h2 className="text-lg font-black text-slate-800">Chi tiết từng agent</h2><Link href="/cskh/report" className="text-xs font-bold text-slate-500 underline">Xem chi tiết toàn bộ dữ liệu</Link></div><div className="mt-3 overflow-x-auto border border-slate-200"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-100 text-left text-xs text-slate-600"><tr><th className="p-3">Agent</th><th className="p-3 text-center">Máy đến kỳ</th><th className="p-3 text-center">Đã chăm sóc</th><th className="p-3 text-center">Đã giao đại lý</th><th className="p-3 text-center">Đã làm dịch vụ</th><th className="p-3 text-center">Tỷ lệ xử lý</th></tr></thead><tbody>{agents.length ? agents.map(a => <tr key={a.name} className="border-t"><td className="p-3 font-bold">{a.name}</td><td className="p-3 text-center">{a.due}</td><td className="p-3 text-center">{a.cared}</td><td className="p-3 text-center">{a.assigned}</td><td className="p-3 text-center">{a.serviced}</td><td className="p-3 text-center font-bold">{a.rate}%</td></tr>) : <tr><td colSpan={6} className="p-8 text-center text-slate-500">Chưa có dữ liệu nhân viên CSKH.</td></tr>}</tbody></table></div></>;
}

function Nav({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}) { return <button type="button" onClick={onClick} className={`block w-full rounded px-3 py-2 text-left text-xs font-semibold transition ${active ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white"}`}>{label}</button>; }
function TopMetric({value,label,note}:{value:number;label:string;note:string}) { return <div><div className="text-2xl font-black text-slate-900">{value}</div><div className="mt-1 text-xs font-bold text-slate-600">{label}</div><div className="mt-1 text-[11px] text-slate-400">{note}</div></div>; }
function Bar({value,max,cls}:{value:number;max:number;cls:string}) { return <div className={`w-3 sm:w-5 ${cls}`} title={String(value)} style={{height:`${Math.max(value ? 8 : 1, value/max*190)}px`}}/>; }
function Legend({dot,text}:{dot:string;text:string}) { return <span className="inline-flex items-center gap-1"><i className={`h-2 w-2 rounded-full ${dot}`}/>{text}</span>; }
function SimpleTable({title,rows}:{title:string;rows:(string|number)[][]}) { return <div><h3 className="mb-2 text-sm font-black text-slate-700">{title}</h3><div className="overflow-hidden border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-100"><tr><th className="p-2 text-left">Nhóm</th><th className="p-2 text-right">Kết quả</th></tr></thead><tbody>{rows.map(([name,value]) => <tr key={String(name)} className="border-t"><td className="p-2 font-semibold text-slate-600">{name}</td><td className="p-2 text-right font-black text-slate-800">{value}</td></tr>)}</tbody></table></div></div>; }
