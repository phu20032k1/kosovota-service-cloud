"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";

type Log = {
  id: string;
  userId?: string | null;
  action: string;
  target?: string | null;
  detail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: string;
};

const date = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

export default function AuditLogsPage() {
  const [data, setData] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin-logs", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được nhật ký");
      setData(result.data || []);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được nhật ký");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const key = q.trim().toLowerCase();
    return key
      ? data.filter((item) => [item.action, item.target, item.userId, item.ipAddress, item.detail].some((value) => value?.toLowerCase().includes(key)))
      : data;
  }, [data, q]);

  return (
    <main className="min-h-screen">
      <OperationsHeader
        title="Nhật ký hệ thống"
        subtitle="Theo dõi thao tác quản trị, IP, thiết bị và dữ liệu thay đổi"
        actions={<button type="button" onClick={() => void load()} className="icon-button"><Icon name="refresh" size={18}/></button>}
      />
      <div className="page-container space-y-6">
        {error && <Notice kind="error">{error}</Notice>}
        <section className="surface-card overflow-hidden">
          <div className="data-toolbar">
            <div className="relative min-w-0 max-w-xl flex-1">
              <Icon name="search" size={18} className="absolute left-3 top-3.5 text-slate-400"/>
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm hành động, mục tiêu, IP hoặc nội dung" className="w-full pl-10"/>
            </div>
            <span className="status-badge badge-slate">{visible.length} bản ghi</span>
          </div>

          {loading ? <LoadingState label="Đang tải nhật ký..."/> : <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead><tr>{["Thời gian","Hành động","Mục tiêu","Người dùng","IP","Chi tiết"].map((header) => <th key={header} className="p-3 text-left">{header}</th>)}</tr></thead>
                <tbody>
                  {visible.map((log) => <tr key={log.id}>
                    <td className="whitespace-nowrap p-3">{date(log.createdAt)}</td>
                    <td className="p-3"><span className="status-badge badge-blue">{log.action}</span></td>
                    <td className="p-3 font-bold">{log.target || "—"}</td>
                    <td className="p-3 text-xs">{log.userId || "Hệ thống"}</td>
                    <td className="p-3 text-xs">{log.ipAddress || "—"}</td>
                    <td className="max-w-xl p-3"><details><summary className="cursor-pointer font-bold text-emerald-700">Xem dữ liệu</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{log.detail || "Không có chi tiết"}</pre></details></td>
                  </tr>)}
                  {!visible.length && <tr><td colSpan={6} className="p-10 text-center text-slate-500">Không có nhật ký phù hợp.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {visible.map((log) => <article key={log.id} className="p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="status-badge badge-blue">{log.action}</span>
                    <p className="mt-2 break-words font-black text-slate-950">{log.target || "Không có mục tiêu"}</p>
                  </div>
                  <span className="shrink-0 text-right text-[11px] leading-5 text-slate-400">{date(log.createdAt)}</span>
                </div>
                <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  <p className="break-all"><strong>Người dùng:</strong> {log.userId || "Hệ thống"}</p>
                  <p className="break-all"><strong>IP:</strong> {log.ipAddress || "—"}</p>
                  {log.requestId && <p className="break-all"><strong>Request:</strong> {log.requestId}</p>}
                </div>
                <details className="mt-3 rounded-xl border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-black text-emerald-700">Xem dữ liệu thay đổi</summary>
                  <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100">{log.detail || "Không có chi tiết"}</pre>
                </details>
              </article>)}
              {!visible.length && <p className="p-10 text-center text-slate-500">Không có nhật ký phù hợp.</p>}
            </div>
          </>}
        </section>
      </div>
    </main>
  );
}
