"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { readApiResponse } from "@/lib/client-api";

type Period = 7 | 14 | 30;
type View = "overview" | "volume" | "performance" | "agents";

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
  };
  trend: Array<{
    date: string;
    dueMachines: number;
    dueTasks: number;
    careActions: number;
    caredMachines: number;
    servicedMachines: number;
    serviceReports: number;
  }>;
  hourly: Array<{ hour: number; careActions: number }>;
  careOutcomes: Array<{ label: string; count: number }>;
  serviceTypes: Array<{ label: string; count: number }>;
  agents: Array<{
    id: string;
    name: string;
    phone: string;
    careActions: number;
    machines: number;
    accepted: number;
    assigned: number;
    serviced: number;
    lastActivity: string | null;
  }>;
};

function shortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00+07:00`));
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function percent(value: number, total: number) {
  return total ? Math.round((value * 100) / total) : 0;
}

export default function CskhDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>(7);
  const [view, setView] = useState<View>("performance");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/cskh/dashboard?period=${period}`, { cache: "no-store" });
      const result = await readApiResponse<DashboardData>(response);
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "Không tải được dữ liệu quản trị CSKH.");
      }
      setData(result.data);
      setError("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được dữ liệu quản trị CSKH.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const metrics = data?.metrics || { tracked: 0, due: 0, dueTasks: 0, cared: 0, assigned: 0, serviced: 0 };
  const careRate = percent(metrics.cared, metrics.due);
  const serviceRate = percent(metrics.serviced, metrics.cared);
  const uncared = Math.max(0, metrics.due - metrics.cared);

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-slate-100">
        <OperationsHeader title="Quản trị CSKH" subtitle="Thống kê chăm sóc khách hàng toàn quốc" />
        <div className="mx-auto max-w-7xl p-5"><LoadingState label="Đang tổng hợp dữ liệu quản trị..." /></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader
        title="Quản trị CSKH"
        subtitle="Thống kê hiệu quả chăm sóc khách hàng toàn quốc"
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="btn-secondary">
              <Icon name="refresh" size={16} /> Tải lại
            </button>
            <Link href="/cskh/report" className="btn-primary px-4 py-2 font-black text-white">
              <Icon name="file" size={16} /> Báo cáo 22 cột
            </Link>
          </div>
        }
      />

      <div className="mx-auto max-w-[1760px] p-3 sm:p-4">
        {error && <div className="mb-3"><Notice kind="error">{error}</Notice></div>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid min-h-[680px] lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
              <div className="p-3">
                <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.13em] text-slate-400">Thống kê</p>
                <SideButton active={view === "overview"} label="Tổng quan chăm sóc" glyph="pulse" onClick={() => setView("overview")} />
                <SideButton active={view === "volume"} label="Khối lượng đến kỳ" glyph="calendar" onClick={() => setView("volume")} />
                <SideButton active={view === "performance"} label="Hiệu quả chăm sóc" glyph="trend" onClick={() => setView("performance")} />
                <SideButton active={view === "agents"} label="Hiệu suất CSKH" glyph="users" onClick={() => setView("agents")} />
                <Link href="/cskh/report" className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-600 transition hover:bg-white hover:text-emerald-700">
                  <NavGlyph kind="table" />
                  <span>Bảng chi tiết 22 cột</span>
                </Link>

                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
                  <p className="font-black text-slate-700">Phạm vi: Toàn quốc</p>
                  <p className="mt-1">Tự cập nhật mỗi 30 giây.</p>
                  <p className="mt-2 border-t border-slate-100 pt-2">Nguồn: lịch đến kỳ, chăm sóc, lệnh dịch vụ và báo cáo hiện trường.</p>
                </div>
              </div>
            </aside>

            <div className="min-w-0 p-4 sm:p-5 lg:p-6">
              <DashboardTop
                view={view}
                period={period}
                setPeriod={setPeriod}
                generatedAt={data?.generatedAt}
              />

              {view === "overview" && data && (
                <Overview
                  data={data}
                  metrics={metrics}
                  careRate={careRate}
                  serviceRate={serviceRate}
                  uncared={uncared}
                />
              )}
              {view === "volume" && data && <VolumeView data={data} />}
              {view === "performance" && data && (
                <PerformanceView
                  data={data}
                  metrics={metrics}
                  careRate={careRate}
                  serviceRate={serviceRate}
                  uncared={uncared}
                />
              )}
              {view === "agents" && data && <AgentsView data={data} />}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardTop({ view, period, setPeriod, generatedAt }: {
  view: View;
  period: Period;
  setPeriod: (value: Period) => void;
  generatedAt?: string;
}) {
  const titles: Record<View, { eyebrow: string; title: string }> = {
    overview: { eyebrow: "Tổng quan", title: "Tổng quan chăm sóc khách hàng" },
    volume: { eyebrow: "Khối lượng", title: "Khối lượng máy đến kỳ chăm sóc" },
    performance: { eyebrow: "Thống kê hiệu quả", title: "Hiệu quả chăm sóc khách hàng" },
    agents: { eyebrow: "Hiệu suất", title: "Hiệu suất nhân viên CSKH" },
  };
  const current = titles[view];
  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{current.eyebrow}</p>
        <h1 className="mt-1 text-xl font-black text-slate-950">{current.title}</h1>
        <p className="mt-1 text-xs text-slate-500">Cập nhật gần nhất: {dateTime(generatedAt)}</p>
      </div>
      <label className="w-full max-w-[140px] text-xs font-bold text-slate-500">
        <span className="mb-1 block">Thời gian</span>
        <select
          value={period}
          onChange={(event) => setPeriod(Number(event.target.value) as Period)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500"
        >
          <option value={7}>7 ngày</option>
          <option value={14}>14 ngày</option>
          <option value={30}>30 ngày</option>
        </select>
      </label>
    </div>
  );
}

function Overview({ data, metrics, careRate, serviceRate, uncared }: {
  data: DashboardData;
  metrics: DashboardData["metrics"];
  careRate: number;
  serviceRate: number;
  uncared: number;
}) {
  return (
    <div className="pt-4">
      <KpiGrid metrics={metrics} />
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <Panel title="Biểu đồ tổng quan theo ngày" subtitle="Máy đến kỳ, lượt chăm sóc và máy đã hoàn tất dịch vụ">
          <GroupedTrendChart trend={data.trend} />
        </Panel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <RateCard title="Tỷ lệ đã chăm sóc" value={careRate} note={`${metrics.cared}/${metrics.due} máy đến kỳ`} />
          <RateCard title="Tỷ lệ hoàn tất dịch vụ" value={serviceRate} note={`${metrics.serviced}/${metrics.cared} máy đã chăm sóc`} />
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 xl:col-span-1">
            <MiniMetric label="Chưa chăm sóc" value={uncared} />
            <MiniMetric label="Đã giao đại lý" value={metrics.assigned} />
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DataList title="Kết quả chăm sóc trong kỳ" rows={data.careOutcomes} empty="Chưa có kết quả chăm sóc trong khoảng thời gian này." />
        <DataList title="Dịch vụ đã hoàn tất trong kỳ" rows={data.serviceTypes} empty="Chưa có báo cáo dịch vụ trong khoảng thời gian này." />
      </div>
    </div>
  );
}

function VolumeView({ data }: { data: DashboardData }) {
  const maxTasks = Math.max(1, ...data.trend.map((item) => item.dueTasks));
  const totalPeriodTasks = data.trend.reduce((sum, item) => sum + item.dueTasks, 0);
  const totalPeriodMachines = new Set(data.trend.flatMap((item) => Array.from({ length: item.dueMachines }, (_, index) => `${item.date}:${index}`))).size;
  const average = data.trend.length ? Math.round((totalPeriodTasks / data.trend.length) * 10) / 10 : 0;

  return (
    <div className="pt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Lịch đến hạn trong kỳ" value={totalPeriodTasks} note="Theo ngày đến hạn" />
        <MetricCard label="Lượt máy theo ngày" value={totalPeriodMachines} note="Tổng số máy của từng ngày" />
        <MetricCard label="Bình quân / ngày" value={average} note="Lịch chăm sóc và thay lõi" />
      </div>
      <Panel className="mt-4" title="Biểu đồ khối lượng đến kỳ" subtitle="Mỗi cột là số lịch chăm sóc / thay lõi đến hạn trong ngày">
        <div className="mt-3 flex h-[320px] items-end gap-1 border-b border-slate-200 px-2 pb-0 sm:gap-2">
          {data.trend.map((item) => (
            <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[10px] font-black text-slate-600">{item.dueTasks || ""}</span>
              <div
                className="w-full max-w-11 rounded-t-sm bg-sky-300 transition-all"
                title={`${item.dueTasks} lịch · ${item.dueMachines} máy`}
                style={{ height: `${Math.max(item.dueTasks ? 8 : 1, (item.dueTasks / maxTasks) * 245)}px` }}
              />
              <span className="mt-2 whitespace-nowrap text-[9px] font-semibold text-slate-500">{shortDate(item.date)}</span>
            </div>
          ))}
        </div>
      </Panel>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="p-3">Ngày</th><th className="p-3 text-center">Máy đến kỳ</th><th className="p-3 text-center">Số lịch/công việc</th><th className="p-3 text-center">Lượt chăm sóc</th><th className="p-3 text-center">Đã làm dịch vụ</th></tr>
          </thead>
          <tbody>
            {data.trend.map((item) => (
              <tr key={item.date} className="border-t border-slate-100">
                <td className="p-3 font-bold text-slate-800">{shortDate(item.date)}</td>
                <td className="p-3 text-center">{item.dueMachines}</td>
                <td className="p-3 text-center">{item.dueTasks}</td>
                <td className="p-3 text-center">{item.careActions}</td>
                <td className="p-3 text-center">{item.servicedMachines}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PerformanceView({ data, metrics, careRate, serviceRate, uncared }: {
  data: DashboardData;
  metrics: DashboardData["metrics"];
  careRate: number;
  serviceRate: number;
  uncared: number;
}) {
  return (
    <div className="pt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Tổng số máy đến kỳ" value={metrics.due} note={`${metrics.dueTasks} lịch/công việc đang đến hạn`} />
        <MetricCard label="Máy đã chăm sóc" value={metrics.cared} note={`${careRate}% số máy đến kỳ`} />
        <MetricCard label="Máy đã thực hiện dịch vụ" value={metrics.serviced} note={`${serviceRate}% số máy đã chăm sóc`} />
      </div>

      <Panel className="mt-4" title="Thống kê hiệu quả theo ngày" subtitle="So sánh máy đến kỳ, lượt CSKH đã xử lý và máy đã hoàn tất dịch vụ">
        <GroupedTrendChart trend={data.trend} />
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DataList title="Theo kết quả chăm sóc" rows={data.careOutcomes} empty="Chưa có kết quả chăm sóc trong kỳ." />
        <div className="grid gap-4">
          <DataList title="Theo dịch vụ đã hoàn tất" rows={data.serviceTypes} empty="Chưa có dịch vụ hoàn tất trong kỳ." />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniMetric label="Chưa CS" value={uncared} />
            <MiniMetric label="Đã CS" value={metrics.cared} />
            <MiniMetric label="Đã giao ĐL" value={metrics.assigned} />
            <MiniMetric label="Đã làm DV" value={metrics.serviced} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentsView({ data }: { data: DashboardData }) {
  const max = Math.max(1, ...data.hourly.map((item) => item.careActions));
  return (
    <div className="pt-4">
      <Panel title="Biểu đồ hoạt động CSKH theo khung giờ" subtitle="Số lượt ghi nhận kết quả chăm sóc theo giờ Việt Nam">
        <div className="mt-4 flex h-[300px] items-end gap-1 border-b border-slate-200 px-2 sm:gap-2">
          {data.hourly.map((item) => (
            <div key={item.hour} className="flex min-w-0 flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[9px] font-black text-slate-600">{item.careActions || ""}</span>
              <div
                className="w-full max-w-8 rounded-t-sm bg-sky-300"
                title={`${item.careActions} lượt chăm sóc`}
                style={{ height: `${Math.max(item.careActions ? 7 : 1, (item.careActions / max) * 220)}px` }}
              />
              <span className="mt-2 text-[8px] text-slate-500">{hourLabel(item.hour)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Chi tiết từng nhân viên CSKH</h2>
          <p className="mt-1 text-xs text-slate-500">Tất cả tài khoản CSKH đang hoạt động, kể cả nhân viên chưa có thao tác trong kỳ.</p>
        </div>
        <Link href="/cskh/report" className="text-xs font-bold text-emerald-700 underline">Xem dữ liệu 22 cột</Link>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-100 text-left text-xs text-slate-600">
            <tr>
              <th className="p-3">Nhân viên</th>
              <th className="p-3 text-center">Lượt chăm sóc</th>
              <th className="p-3 text-center">Máy đã xử lý</th>
              <th className="p-3 text-center">Khách nhận DV</th>
              <th className="p-3 text-center">Đã giao đại lý</th>
              <th className="p-3 text-center">Đã hoàn tất DV</th>
              <th className="p-3">Hoạt động gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {data.agents.length ? data.agents.map((agent) => (
              <tr key={agent.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                <td className="p-3"><p className="font-black text-slate-800">{agent.name}</p><p className="mt-0.5 text-xs text-slate-400">{agent.phone}</p></td>
                <td className="p-3 text-center font-bold">{agent.careActions}</td>
                <td className="p-3 text-center">{agent.machines}</td>
                <td className="p-3 text-center">{agent.accepted}</td>
                <td className="p-3 text-center">{agent.assigned}</td>
                <td className="p-3 text-center">{agent.serviced}</td>
                <td className="p-3 text-slate-500">{dateTime(agent.lastActivity)}</td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">Chưa có tài khoản CSKH đang hoạt động.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiGrid({ metrics }: { metrics: DashboardData["metrics"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Tổng máy theo dõi" value={metrics.tracked} note="Máy đã hoàn tất kích hoạt" />
      <MetricCard label="Đến kỳ chăm sóc" value={metrics.due} note={`${metrics.dueTasks} lịch/công việc đến hạn`} />
      <MetricCard label="Đã chăm sóc" value={metrics.cared} note="Máy đã có kết quả CSKH" />
      <MetricCard label="Đã giao đại lý" value={metrics.assigned} note="Máy đã có đại lý nhận DV" />
      <MetricCard label="Đã làm dịch vụ" value={metrics.serviced} note="Có báo cáo hoặc đã hoàn tất" />
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black leading-none text-slate-950">{value}</p>
      {note && <p className="mt-2 text-[11px] leading-4 text-slate-400">{note}</p>}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function RateCard({ title, value, note }: { title: string; value: number; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}%</p>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[6px] border-emerald-100 bg-white text-xs font-black text-emerald-700">{value}%</div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, className = "", children }: { title: string; subtitle?: string; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>
      <div>
        <h2 className="text-sm font-black text-slate-800">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function GroupedTrendChart({ trend }: { trend: DashboardData["trend"] }) {
  const max = Math.max(1, ...trend.flatMap((item) => [item.dueMachines, item.careActions, item.servicedMachines]));
  return (
    <>
      <div className="mt-4 flex h-[300px] items-end gap-1 border-b border-slate-200 px-1 sm:gap-3">
        {trend.map((item) => (
          <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center justify-end">
            <div className="flex h-[245px] w-full items-end justify-center gap-[2px] sm:gap-1">
              <ChartBar value={item.dueMachines} max={max} color="#fb923c" label="Máy đến kỳ" />
              <ChartBar value={item.careActions} max={max} color="#38bdf8" label="Lượt chăm sóc" />
              <ChartBar value={item.servicedMachines} max={max} color="#10b981" label="Đã làm dịch vụ" />
            </div>
            <span className="mt-2 whitespace-nowrap text-[9px] font-semibold text-slate-500">{shortDate(item.date)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] font-bold text-slate-500">
        <Legend color="#fb923c" label="Máy đến kỳ" />
        <Legend color="#38bdf8" label="Lượt chăm sóc" />
        <Legend color="#10b981" label="Đã làm dịch vụ" />
      </div>
    </>
  );
}

function ChartBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const height = Math.max(value ? 7 : 1, (value / max) * 220);
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col justify-end">
      {value > 0 && <span className="mb-1 text-center text-[9px] font-black text-slate-500">{value}</span>}
      <div className="w-full rounded-t-sm" title={`${label}: ${value}`} style={{ height: `${height}px`, backgroundColor: color }} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>;
}

function DataList({ title, rows, empty }: { title: string; rows: Array<{ label: string; count: number }>; empty: string }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-black text-slate-800">{title}</h3>
        <span className="text-xs font-bold text-slate-400">Tổng {total}</span>
      </div>
      {rows.length ? (
        <div className="divide-y divide-slate-100">
          {rows.slice(0, 8).map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate font-semibold text-slate-600" title={row.label}>{row.label}</span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{row.count}</span>
            </div>
          ))}
        </div>
      ) : <p className="p-6 text-center text-sm text-slate-400">{empty}</p>}
    </section>
  );
}

function SideButton({ active, label, glyph, onClick }: { active: boolean; label: string; glyph: GlyphKind; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${active ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white hover:text-slate-900"}`}
    >
      <NavGlyph kind={glyph} />
      <span>{label}</span>
    </button>
  );
}

type GlyphKind = "pulse" | "calendar" | "trend" | "users" | "table";
function NavGlyph({ kind }: { kind: GlyphKind }) {
  const common = "h-4 w-4 shrink-0";
  if (kind === "calendar") return <svg viewBox="0 0 24 24" fill="none" className={common} stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
  if (kind === "users") return <svg viewBox="0 0 24 24" fill="none" className={common} stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M16 5.5a3 3 0 0 1 0 5.5M17 14c2.6.5 4 2.4 4 5"/></svg>;
  if (kind === "table") return <svg viewBox="0 0 24 24" fill="none" className={common} stroke="currentColor" strokeWidth="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h8"/></svg>;
  if (kind === "trend") return <svg viewBox="0 0 24 24" fill="none" className={common} stroke="currentColor" strokeWidth="1.8"><path d="M3 17l5-5 4 3 7-8"/><path d="M15 7h4v4"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" className={common} stroke="currentColor" strokeWidth="1.8"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>;
}

function hourLabel(hour: number) {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}
