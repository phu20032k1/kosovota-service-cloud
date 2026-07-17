"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export type ExecutiveReportKey = "machines" | "revenue" | "overdue" | "tickets" | "dealers" | "inventory" | "paid" | "payable";
type ReportData = { title: string; subtitle: string; total: number; generatedAt: string; columns: { key: string; label: string; align?: "left" | "right" }[]; rows: Record<string, string | number | null>[] };

export function ExecutiveReportDialog({ report, onClose }: { report: ExecutiveReportKey | null; onClose: () => void }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!report) return;
    let cancelled = false;
    setLoading(true); setError(""); setData(null);
    fetch(`/api/admin/executive-dashboard/detail?report=${report}`, { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => { if (!cancelled) { if (!response.ok || !result.success) throw new Error(result.message || "Không tải được báo cáo"); setData(result.data); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được báo cáo"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [report]);

  useEffect(() => {
    if (!report) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", closeOnEscape); };
  }, [report, onClose]);

  if (!report) return null;
  return <div className="report-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="report-dialog-panel">
      <header className="report-dialog-header">
        <div className="min-w-0"><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Báo cáo chi tiết</p><h2 id="report-dialog-title" className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{data?.title || "Đang tải báo cáo..."}</h2>{data?.subtitle && <p className="mt-1 text-sm text-slate-500">{data.subtitle}</p>}</div>
        <button type="button" onClick={onClose} className="icon-button report-dialog-close" title="Đóng báo cáo" aria-label="Đóng báo cáo"><Icon name="x" size={20}/></button>
      </header>
      <div className="report-dialog-body">
        {loading && <div className="empty-state"><div><span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600"/><p className="font-bold">Đang tổng hợp dữ liệu...</p></div></div>}
        {error && <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</div>}
        {data && !data.rows.length && <div className="empty-state"><div><Icon name="check" size={30} className="mx-auto mb-2 text-emerald-600"/><p className="font-bold">Không có dữ liệu trong báo cáo này.</p></div></div>}
        {data && data.rows.length > 0 && <>
          <div className="report-table-wrap hidden md:block"><table className="report-table text-sm"><thead><tr>{data.columns.map((column) => <th key={column.key} className={column.align === "right" ? "text-right" : "text-left"}>{column.label}</th>)}<th className="sticky right-0 bg-slate-50 text-right">Thao tác</th></tr></thead><tbody>{data.rows.map((row, index) => <tr key={`${report}-${index}`}>{data.columns.map((column) => <td key={column.key} className={column.align === "right" ? "text-right font-bold" : "text-left"}>{row[column.key] ?? "—"}</td>)}<td className="sticky right-0 bg-white text-right">{typeof row._href === "string" && <Link href={row._href} onClick={onClose} className="btn-secondary whitespace-nowrap text-xs">Xem hồ sơ</Link>}</td></tr>)}</tbody></table></div>
          <div className="space-y-3 p-3 md:hidden">{data.rows.map((row, index) => <article key={`${report}-mobile-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><dl className="space-y-2.5">{data.columns.map((column) => <div key={column.key} className="grid grid-cols-[minmax(88px,35%)_1fr] gap-3"><dt className="text-xs font-bold text-slate-500">{column.label}</dt><dd className="break-words text-right text-sm font-bold text-slate-900">{row[column.key] ?? "—"}</dd></div>)}</dl>{typeof row._href === "string" && <Link href={row._href} onClick={onClose} className="btn-secondary mt-4 w-full">Xem hồ sơ chi tiết</Link>}</article>)}</div>
        </>}
      </div>
      {data && <footer className="report-dialog-footer"><span><strong>{data.total}</strong> bản ghi</span><span>{data.total > data.rows.length ? `Hiển thị ${data.rows.length} bản ghi mới nhất` : "Đã hiển thị đầy đủ"}</span></footer>}
    </section>
  </div>;
}
