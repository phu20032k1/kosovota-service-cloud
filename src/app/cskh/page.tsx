"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { readApiResponse } from "@/lib/client-api";

type ReportRow = {
  id: string;
  date: string | null;
  machineId: string;
  machineCode: string;
  customerName: string;
  customerPhone: string;
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

type ToolLink = { href: string; label: string; icon: IconName };

const TOOLS: ToolLink[] = [
  { href: "/cskh/report", label: "Báo cáo 22 cột", icon: "file" },
  { href: "/cskh/customers", label: "Khách hàng", icon: "users" },
  { href: "/cskh/dealers", label: "Đại lý theo tỉnh", icon: "store" },
  { href: "/cskh/requests", label: "Yêu cầu khách hàng", icon: "file" },
  { href: "/cskh/dispatch", label: "Điều phối CSOS", icon: "route" },
  { href: "/maintenance-plans", label: "Lịch chăm sóc & thay lõi", icon: "calendar" },
];

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

function localDateKey(value = new Date()) {
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

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function wasCared(row: ReportRow) {
  return Boolean(row.currentCareResult) || CARED.has(row.status);
}

function wasServiced(row: ReportRow) {
  return row.reportCount > 0 || row.status === "COMPLETED";
}

export default function CustomerCareWorkspacePage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/cskh/report", { cache: "no-store" });
      const result = await readApiResponse<ReportData>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không tải được thống kê CSKH.");
      setData(result.data);
      setError("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được thống kê CSKH.");
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
  const uncared = Math.max(0, metrics.total - metrics.cared);
  const unassigned = Math.max(0, metrics.cared - metrics.assigned);
  const careRate = metrics.total ? Math.round((metrics.cared / metrics.total) * 100) : 0;
  const serviceRate = metrics.cared ? Math.round((metrics.serviced / metrics.cared) * 100) : 0;

  const trend = useMemo(() => {
    const source = data?.rows || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const value = new Date(today);
      value.setDate(value.getDate() - 3 + index);
      const key = localDateKey(value);
      const dueRows = source.filter((row) => isoDate(row.date) === key);
      const activityRows = source.filter((row) => isoDate(row.updatedAt) === key || isoDate(row.date) === key);
      return {
        key,
        due: new Set(dueRows.map((row) => row.machineId)).size,
        cared: new Set(activityRows.filter(wasCared).map((row) => row.machineId)).size,
        serviced: new Set(activityRows.filter(wasServiced).map((row) => row.machineId)).size,
      };
    });
  }, [data]);

  const agents = useMemo(() => {
    const groups = new Map<string, ReportRow[]>();
    for (const row of data?.rows || []) {
      const name = row.cskhName.trim() || "Chưa gán NV CSKH";
      const current = groups.get(name) || [];
      current.push(row);
      groups.set(name, current);
    }
    return [...groups.entries()].map(([name, rows]) => {
      const machines = new Set(rows.map((row) => row.machineId)).size;
      const cared = new Set(rows.filter(wasCared).map((row) => row.machineId)).size;
      const assigned = new Set(rows.filter((row) => Boolean(row.dealerCode)).map((row) => row.machineId)).size;
      const serviced = new Set(rows.filter(wasServiced).map((row) => row.machineId)).size;
      return {
        name,
        machines,
        cared,
        assigned,
        serviced,
        completion: machines ? Math.round((serviced / machines) * 100) : 0,
      };
    }).sort((a, b) => b.cared - a.cared || b.serviced - a.serviced || a.name.localeCompare(b.name, "vi"));
  }, [data]);

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-slate-100">
        <OperationsHeader title="Trung tâm CSKH" subtitle="Báo cáo hiệu quả chăm sóc khách hàng" />
        <div className="mx-auto max-w-7xl p-5"><LoadingState label="Đang tải dữ liệu CSKH..."/></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader
        title="Trung tâm CSKH"
        subtitle="Hiệu quả chăm sóc, lịch thay lõi và tiến độ thực hiện dịch vụ"
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="btn-secondary"><Icon name="refresh" size={16}/>Tải lại</button>
            <Link href="/cskh/report" className="btn-primary px-4 py-2 font-black text-white"><Icon name="file" size={16}/>Mở báo cáo 22 cột</Link>
          </div>
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-4 p-3 sm:p-5">
        {error && <Notice kind="error">{error}</Notice>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Tổng máy theo dõi" value={metrics.total} note="Máy có trong báo cáo CSKH" tone="slate" href="/cskh/report"/>
          <Metric label="Máy đến kỳ chăm sóc" value={metrics.due} note="Đến hạn hoặc quá hạn" tone="rose" href="/cskh/report"/>
          <Metric label="Máy đã chăm sóc" value={metrics.cared} note={`${careRate}% tổng máy`} tone="sky" href="/cskh/report"/>
          <Metric label="Đã giao đại lý" value={metrics.assigned} note="Đã có đơn vị nhận dịch vụ" tone="amber" href="/cskh/dispatch"/>
          <Metric label="Đã thực hiện dịch vụ" value={metrics.serviced} note={`${serviceRate}% máy đã chăm sóc`} tone="emerald" href="/cskh/report"/>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
              <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Thống kê CSKH</p>
              <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
                <div className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-black text-emerald-700 shadow-sm ring-1 ring-slate-200 lg:w-full"><Icon name="activity" size={17}/>Hiệu quả chăm sóc</div>
                {TOOLS.map((tool) => (
                  <Link key={tool.href} href={tool.href} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-emerald-700 lg:w-full">
                    <Icon name={tool.icon} size={17}/>{tool.label}
                  </Link>
                ))}
              </div>
              <div className="mt-5 hidden rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-500 lg:block">
                <strong className="text-slate-700">Tự cập nhật mỗi 30 giây.</strong><br/>
                Khi quay lại tab hoặc cửa sổ, số liệu được tải lại ngay.
              </div>
            </aside>

            <div className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Báo cáo hiệu quả chăm sóc khách hàng</p>
                  <h1 className="mt-1 text-xl font-black text-slate-950">Đến kỳ → đã chăm sóc → đã thực hiện dịch vụ</h1>
                  <p className="mt-1 text-sm text-slate-500">Cập nhật gần nhất: {formatDateTime(data?.generatedAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                  <Legend tone="orange" label="Đến kỳ"/>
                  <Legend tone="sky" label="Đã chăm sóc"/>
                  <Legend tone="emerald" label="Đã làm dịch vụ"/>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.45fr)]">
                <TrendChart rows={trend}/>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <RateCard label="Tỷ lệ đã chăm sóc" value={careRate} note={`${metrics.cared}/${metrics.total} máy`}/>
                  <RateCard label="Tỷ lệ làm dịch vụ" value={serviceRate} note={`${metrics.serviced}/${metrics.cared || 0} máy đã chăm sóc`}/>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="Chưa chăm sóc" value={uncared} tone="rose"/>
                    <MiniStat label="Chưa giao ĐL" value={unassigned} tone="amber"/>
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
              <h2 className="mt-1 text-xl font-black text-slate-950">Hiệu quả CSKH theo người phụ trách</h2>
            </div>
            <Link href="/cskh/report" className="inline-flex items-center gap-1 text-sm font-black text-emerald-700">Xem bảng chi tiết <Icon name="chevron-right" size={16}/></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3 sm:p-4">Nhân viên</th>
                  <th className="p-3 text-center">Máy phụ trách</th>
                  <th className="p-3 text-center">Đã chăm sóc</th>
                  <th className="p-3 text-center">Đã giao đại lý</th>
                  <th className="p-3 text-center">Đã làm dịch vụ</th>
                  <th className="p-3 text-center">Tỷ lệ hoàn tất</th>
                </tr>
              </thead>
              <tbody>
                {!agents.length ? (
                  <tr><td colSpan={6} className="p-8 text-center font-semibold text-slate-500">Chưa có dữ liệu nhân viên CSKH.</td></tr>
                ) : agents.map((agent) => (
                  <tr key={agent.name} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-black text-slate-900 sm:p-4">{agent.name}</td>
                    <td className="p-3 text-center font-bold">{agent.machines}</td>
                    <td className="p-3 text-center font-bold text-sky-700">{agent.cared}</td>
                    <td className="p-3 text-center font-bold text-amber-700">{agent.assigned}</td>
                    <td className="p-3 text-center font-bold text-emerald-700">{agent.serviced}</td>
                    <td className="p-3">
                      <div className="mx-auto flex max-w-[160px] items-center gap-2">
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

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickLink href="/cskh/report" icon="file" title="Bảng CSKH 22 cột" description="Giữ đúng luồng gọi chăm sóc → tìm đại lý → kết quả dịch vụ."/>
          <QuickLink href="/maintenance-plans" icon="calendar" title="Lịch chăm sóc & thay lõi" description="Theo dõi quá hạn, hôm nay, 7 ngày tới và lịch đã tạo lệnh."/>
          <QuickLink href="/cskh/customers" icon="users" title="Tra cứu khách hàng" description="Tìm theo khách hàng, điện thoại, máy và lịch sử chăm sóc."/>
          <QuickLink href="/cskh/dispatch" icon="route" title="Điều phối dịch vụ" description="Theo dõi lệnh cần giao và tiến độ đại lý xử lý."/>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, note, tone, href }: { label: string; value: number; note: string; tone: "slate" | "rose" | "sky" | "amber" | "emerald"; href: string }) {
  const styles = {
    slate: "border-slate-200 bg-white text-slate-950",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  } as const;
  return <Link href={href} className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${styles[tone]}`}><p className="text-xs font-black uppercase tracking-wider opacity-70">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-1 text-xs font-semibold opacity-70">{note}</p></Link>;
}

function TrendChart({ rows }: { rows: Array<{ key: string; due: number; cared: number; serviced: number }> }) {
  const maximum = Math.max(1, ...rows.flatMap((item) => [item.due, item.cared, item.serviced]));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex h-[300px] items-end gap-3 overflow-x-auto border-b border-l border-slate-200 px-2 sm:gap-5">
        {rows.map((item) => (
          <div key={item.key} className="flex min-w-[76px] flex-1 flex-col items-center justify-end self-stretch">
            <div className="flex h-[255px] w-full items-end justify-center gap-1.5">
              <Bar value={item.due} maximum={maximum} className="bg-orange-400"/>
              <Bar value={item.cared} maximum={maximum} className="bg-sky-400"/>
              <Bar value={item.serviced} maximum={maximum} className="bg-emerald-500"/>
            </div>
            <p className="py-2 text-[11px] font-bold text-slate-500">{shortDate(item.key)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ value, maximum, className }: { value: number; maximum: number; className: string }) {
  const height = value ? Math.max(7, Math.round((value / maximum) * 100)) : 2;
  return <div title={`${value}`} className={`relative w-3 rounded-t sm:w-4 ${className}`} style={{ height: `${height}%` }}><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500">{value || ""}</span></div>;
}

function Legend({ tone, label }: { tone: "orange" | "sky" | "emerald"; label: string }) {
  const tones = { orange: "bg-orange-400", sky: "bg-sky-400", emerald: "bg-emerald-500" } as const;
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${tones[tone]}`}/>{label}</span>;
}

function RateCard({ label, value, note }: { label: string; value: number; note: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}%</p></div><div className="grid h-14 w-14 place-items-center rounded-full border-[6px] border-emerald-100 text-xs font-black text-emerald-700">{value}%</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, value)}%` }}/></div><p className="mt-2 text-xs text-slate-500">{note}</p></div>;
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "rose" | "amber" }) {
  const style = tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700";
  return <div className={`rounded-2xl p-4 ${style}`}><p className="text-[11px] font-black uppercase tracking-wide opacity-70">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
}

function QuickLink({ href, icon, title, description }: { href: string; icon: IconName; title: string; description: string }) {
  return <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon name={icon} size={19}/></span><h3 className="mt-3 font-black text-slate-950">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-700">Mở chức năng <Icon name="chevron-right" size={14} className="transition group-hover:translate-x-0.5"/></span></Link>;
}
