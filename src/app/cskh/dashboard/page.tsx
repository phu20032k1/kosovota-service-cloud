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
  province: string;
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

const CARED = new Set([
  "CALLED_NO_ANSWER",
  "CUSTOMER_ACCEPTED",
  "CUSTOMER_SELF_SERVICE",
  "CUSTOMER_INTERNAL",
  "CUSTOMER_REJECTED",
  "RESCHEDULED",
  "COMPLAINT",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
]);

function dayKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`));
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function wasCared(row: ReportRow) {
  return Boolean(row.currentCareResult) || CARED.has(row.status);
}

function wasServiced(row: ReportRow) {
  return row.reportCount > 0 || row.status === "COMPLETED";
}

export default function CskhDashboardPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>(7);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/cskh/report", { cache: "no-store" });
      const result = await readApiResponse<ReportData>(response);
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "Không tải được báo cáo CSKH.");
      }
      setData(result.data);
      setError("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được báo cáo CSKH.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const metrics = data?.metrics || { total: 0, due: 0, cared: 0, serviced: 0, assigned: 0 };
  const careRate = metrics.total ? Math.round((metrics.cared / metrics.total) * 100) : 0;
  const serviceRate = metrics.cared ? Math.round((metrics.serviced / metrics.cared) * 100) : 0;
  const uncared = Math.max(0, metrics.due - metrics.cared);

  const trend = useMemo(() => {
    const rows = data?.rows || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: period }, (_, index) => {
      const value = new Date(today);
      value.setDate(value.getDate() - (period - 1 - index));
      const key = dayKey(value);
      const dueRows = rows.filter((row) => isoDate(row.date) === key);
      const changedRows = rows.filter((row) => isoDate(row.updatedAt) === key);
      return {
        key,
        due: new Set(dueRows.map((row) => row.machineId)).size,
        cared: new Set(changedRows.filter(wasCared).map((row) => row.machineId)).size,
        serviced: new Set(changedRows.filter(wasServiced).map((row) => row.machineId)).size,
      };
    });
  }, [data, period]);

  const agents = useMemo(() => {
    const groups = new Map<string, ReportRow[]>();
    for (const row of data?.rows || []) {
      const name = row.cskhName.trim() || "Chưa ghi nhận nhân viên";
      const rows = groups.get(name) || [];
      rows.push(row);
      groups.set(name, rows);
    }
    return [...groups.entries()].map(([name, rows]) => {
      const machines = new Set(rows.map((row) => row.machineId)).size;
      const due = new Set(rows.filter((row) => row.date && new Date(row.date) <= new Date()).map((row) => row.machineId)).size;
      const cared = new Set(rows.filter(wasCared).map((row) => row.machineId)).size;
      const assigned = new Set(rows.filter((row) => Boolean(row.dealerCode)).map((row) => row.machineId)).size;
      const serviced = new Set(rows.filter(wasServiced).map((row) => row.machineId)).size;
      return {
        name,
        machines,
        due,
        cared,
        assigned,
        serviced,
        completion: due ? Math.round((cared / due) * 100) : 0,
      };
    }).sort((a, b) => b.cared - a.cared || b.serviced - a.serviced || a.name.localeCompare(b.name, "vi"));
  }, [data]);

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-slate-100">
        <OperationsHeader title="Báo cáo CSKH" subtitle="Thống kê hiệu quả chăm sóc khách hàng" />
        <div className="mx-auto max-w-7xl p-5"><LoadingState label="Đang tải bảng báo cáo..."/></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader
        title="Báo cáo CSKH"
        subtitle="Bảng quản trị hiệu quả chăm sóc và dịch vụ toàn quốc"
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="btn-secondary"><Icon name="refresh" size={16}/>Tải lại</button>
            <Link href="/cskh/report" className="btn-primary px-4 py-2 font-black text-white"><Icon name="file" size={16}/>Bảng chi tiết</Link>
          </div>
        }
      />

      <div className="mx-auto max-w-[1700px] space-y-4 p-3 sm:p-5">
        {error && <Notice kind="error">{error}</Notice>}

        <section className="grid gap-3 md:grid-cols-3">
          <KpiCard label="Máy đến kỳ chăm sóc" value={metrics.due} note={`${uncared} máy chưa chăm sóc`} accent="rose" />
          <KpiCard label="Máy đã chăm sóc" value={metrics.cared} note={`${careRate}% tổng máy theo dõi`} accent="sky" />
          <KpiCard label="Máy đã thực hiện dịch vụ" value={metrics.serviced} note={`${serviceRate}% trên số máy đã chăm sóc`} accent="emerald" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
              <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Thống kê</p>
              <div className="space-y-1">
                <SideItem label="Tổng quan chăm sóc" icon="activity" />
                <SideItem label="Khối lượng đến kỳ" icon="calendar" />
                <SideItem label="Hiệu quả chăm sóc" icon="activity" active />
                <SideItem label="Hiệu suất CSKH" icon="users" />
                <Link href="/cskh/report" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-emerald-700"><Icon name="file" size={17}/>Bảng chi tiết 22 cột</Link>
              </div>
              <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-500">
                <strong className="text-slate-700">Phạm vi: Toàn quốc</strong><br/>
                Tự cập nhật mỗi 30 giây.
              </div>
            </aside>

            <div className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Thống kê hiệu quả</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Hiệu quả chăm sóc khách hàng</h2>
                  <p className="mt-1 text-sm text-slate-500">Cập nhật gần nhất: {dateTime(data?.generatedAt)}</p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs font-bold text-slate-500">
                    <span className="mb-1 block">Thời gian</span>
                    <select value={period} onChange={(event) => setPeriod(Number(event.target.value) as Period)} className="min-w-[130px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                      <option value={7}>7 ngày</option>
                      <option value={14}>14 ngày</option>
                      <option value={30}>30 ngày</option>
                    </select>
                  </label>
                  <div className="flex gap-2 text-xs font-bold text-slate-600">
                    <Legend className="bg-orange-400" label="Đến kỳ" />
                    <Legend className="bg-sky-400" label="Đã chăm sóc" />
                    <Legend className="bg-emerald-500" label="Đã làm DV" />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MiniMetric label="Tổng máy theo dõi" value={metrics.total} />
                <MiniMetric label="Đến kỳ" value={metrics.due} />
                <MiniMetric label="Đã chăm sóc" value={metrics.cared} />
                <MiniMetric label="Đã giao đại lý" value={metrics.assigned} />
                <MiniMetric label="Đã làm dịch vụ" value={metrics.serviced} />
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_320px]">
                <TrendChart rows={trend} />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <RateCard label="Tỷ lệ đã chăm sóc" value={careRate} detail={`${metrics.cared}/${metrics.total} máy`} />
                  <RateCard label="Tỷ lệ hoàn tất dịch vụ" value={serviceRate} detail={`${metrics.serviced}/${metrics.cared || 0} máy đã chăm sóc`} />
                  <div className="grid grid-cols-2 gap-3">
                    <SmallStat label="Chưa chăm sóc" value={uncared} />
                    <SmallStat label="Đã giao đại lý" value={metrics.assigned} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Chi tiết từng nhân viên</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Hiệu suất CSKH</h2>
            </div>
            <Link href="/cskh/report" className="inline-flex items-center gap-1 text-sm font-black text-emerald-700">Xem toàn bộ dữ liệu <Icon name="chevron-right" size={16}/></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-4">Nhân viên CSKH</th>
                  <th className="p-3 text-center">Máy theo dõi</th>
                  <th className="p-3 text-center">Đến kỳ</th>
                  <th className="p-3 text-center">Đã chăm sóc</th>
                  <th className="p-3 text-center">Đã giao đại lý</th>
                  <th className="p-3 text-center">Đã làm dịch vụ</th>
                  <th className="p-3 text-center">Tỷ lệ chăm sóc</th>
                </tr>
              </thead>
              <tbody>
                {!agents.length ? (
                  <tr><td colSpan={7} className="p-10 text-center font-semibold text-slate-500">Chưa có dữ liệu CSKH.</td></tr>
                ) : agents.map((agent) => (
                  <tr key={agent.name} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-4 font-black text-slate-900">{agent.name}</td>
                    <td className="p-3 text-center font-bold">{agent.machines}</td>
                    <td className="p-3 text-center font-bold text-orange-700">{agent.due}</td>
                    <td className="p-3 text-center font-bold text-sky-700">{agent.cared}</td>
                    <td className="p-3 text-center font-bold text-amber-700">{agent.assigned}</td>
                    <td className="p-3 text-center font-bold text-emerald-700">{agent.serviced}</td>
                    <td className="p-3">
                      <div className="mx-auto flex max-w-[170px] items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, agent.completion)}%` }}/></div>
                        <strong className="w-10 text-right text-xs">{agent.completion}%</strong>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function KpiCard({ label, value, note, accent }: { label: string; value: number; note: string; accent: "rose" | "sky" | "emerald" }) {
  const styles = {
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  } as const;
  return <div className={`rounded-2xl border p-5 shadow-sm ${styles[accent]}`}><p className="text-xs font-black uppercase tracking-wider opacity-75">{label}</p><div className="mt-2 flex items-end justify-between gap-3"><strong className="text-4xl font-black">{value}</strong><span className="text-right text-xs font-bold opacity-75">{note}</span></div></div>;
}

function SideItem({ label, icon, active = false }: { label: string; icon: "activity" | "calendar" | "users"; active?: boolean }) {
  return <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${active ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600"}`}><Icon name={icon} size={17}/>{label}</div>;
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>;
}

function Legend({ className, label }: { className: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className={`h-2.5 w-2.5 rounded-sm ${className}`}/>{label}</span>;
}

function TrendChart({ rows }: { rows: Array<{ key: string; due: number; cared: number; serviced: number }> }) {
  const maximum = Math.max(1, ...rows.flatMap((row) => [row.due, row.cared, row.serviced]));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-black text-slate-800">Biểu đồ hiệu quả theo ngày</p>
      <div className="overflow-x-auto pb-1">
        <div className="flex h-[310px] min-w-max items-end border-b border-l border-slate-200 px-3">
          {rows.map((row) => (
            <div key={row.key} className="flex h-full w-[72px] flex-col items-center justify-end">
              <div className="flex h-[260px] items-end gap-1.5">
                <Bar value={row.due} maximum={maximum} className="bg-orange-400" />
                <Bar value={row.cared} maximum={maximum} className="bg-sky-400" />
                <Bar value={row.serviced} maximum={maximum} className="bg-emerald-500" />
              </div>
              <span className="py-2 text-[11px] font-bold text-slate-500">{shortDate(row.key)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bar({ value, maximum, className }: { value: number; maximum: number; className: string }) {
  const height = value ? Math.max(8, Math.round((value / maximum) * 100)) : 2;
  return <div title={String(value)} className={`relative w-3 rounded-t ${className}`} style={{ height: `${height}%` }}><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-500">{value || ""}</span></div>;
}

function RateCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}%</p><p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p></div><div className="flex h-14 w-14 items-center justify-center rounded-full border-[7px] border-emerald-100 text-xs font-black text-emerald-700">{value}%</div></div></div>;
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 text-center"><p className="text-[11px] font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>;
}
