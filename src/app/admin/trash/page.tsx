"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";

type TrashItem = {
  id: string; entityType: string; entityId: string; label: string;
  deletedByName?: string | null; deletedAt: string; restoreSupported: boolean;
};
type NoticeState = { kind: "success" | "error" | "info"; text: string } | null;

const TYPE_LABELS: Record<string, string> = {
  USER: "Tài khoản", CUSTOMER: "Khách hàng", DEALER: "Đại lý / CTV",
  SERVICE_ORDER: "Lệnh dịch vụ", SUPPORT_TICKET: "Yêu cầu",
  MAINTENANCE_SCHEDULE: "Lịch bảo trì",
};

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/trash", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được Thùng rác.");
      setItems(result.data || []);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được Thùng rác." });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => items.filter((item) => {
    const haystack = (item.label + " " + item.entityId + " " + item.entityType + " " + (item.deletedByName || "")).toLowerCase();
    return (!type || item.entityType === type) && (!search || haystack.includes(search.toLowerCase()));
  }), [items, search, type]);
  const typeOptions = useMemo(() => Array.from(new Set(items.map((item) => item.entityType))).sort(), [items]);

  async function restore(item: TrashItem) {
    if (!window.confirm("Khôi phục “" + item.label + "” về hệ thống?")) return;
    setBusyId(item.id); setNotice(null);
    try {
      const response = await fetch("/api/admin/trash/" + item.id + "/restore", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không khôi phục được dữ liệu.");
      setNotice({ kind: "success", text: result.message }); await load();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không khôi phục được dữ liệu." });
    } finally { setBusyId(""); }
  }

  async function permanentDelete(item: TrashItem) {
    if (!window.confirm("XÓA VĨNH VIỄN bản lưu “" + item.label + "”? Sau bước này không thể khôi phục từ KOSOVOTA.")) return;
    setBusyId(item.id); setNotice(null);
    try {
      const response = await fetch("/api/admin/trash", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không xóa vĩnh viễn được dữ liệu.");
      setNotice({ kind: "success", text: result.message }); await load();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không xóa vĩnh viễn được dữ liệu." });
    } finally { setBusyId(""); }
  }

  return <main className="min-h-screen bg-slate-50/70">
    <OperationsHeader title="Thùng rác dữ liệu" subtitle="Dữ liệu bị xóa được lưu tại đây trước khi xóa vĩnh viễn" />
    <section className="mx-auto max-w-[1480px] space-y-5 p-3 sm:p-5">
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Đang lưu trong thùng rác" value={items.length} icon="trash" tone="rose" />
        <MetricCard label="Có thể khôi phục" value={items.filter((item) => item.restoreSupported).length} icon="refresh" tone="emerald" />
        <MetricCard label="Tài khoản / khách" value={items.filter((item) => ["USER", "CUSTOMER"].includes(item.entityType)).length} icon="users" tone="blue" />
        <MetricCard label="Vận hành / dịch vụ" value={items.filter((item) => !["USER", "CUSTOMER"].includes(item.entityType)).length} icon="database" tone="amber" />
      </div>
      <div className="surface-card grid gap-3 p-3 md:grid-cols-[1fr_240px_auto]">
        <label className="relative"><Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className="pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã, người xóa..." /></label>
        <select value={type} onChange={(event) => setType(event.target.value)}><option value="">Tất cả loại dữ liệu</option>{typeOptions.map((value) => <option key={value} value={value}>{TYPE_LABELS[value] || value}</option>)}</select>
        <button type="button" className="btn-secondary" onClick={() => { setSearch(""); setType(""); }}><Icon name="x" size={17} />Xóa lọc</button>
      </div>
      {loading ? <LoadingState /> : <div className="table-shell">
        <div className="hidden overflow-x-auto md:block"><table className="min-w-full text-sm"><thead><tr>{["Loại","Dữ liệu","Mã gốc","Người xóa","Thời gian","Khôi phục","Xóa vĩnh viễn"].map((head)=><th key={head} className="p-3 text-left">{head}</th>)}</tr></thead><tbody>
          {filtered.map((item)=><tr key={item.id}><td className="p-3"><span className="status-pill status-blue">{TYPE_LABELS[item.entityType] || item.entityType}</span></td><td className="max-w-sm p-3 font-bold text-slate-900">{item.label}</td><td className="p-3 text-xs text-slate-500">{item.entityId}</td><td className="p-3">{item.deletedByName || "Không rõ"}</td><td className="whitespace-nowrap p-3 text-xs text-slate-500">{new Date(item.deletedAt).toLocaleString("vi-VN")}</td><td className="p-3">{item.restoreSupported ? <button type="button" className="btn-secondary px-3 py-2 text-xs" disabled={busyId===item.id} onClick={()=>void restore(item)}><Icon name="refresh" size={15}/>Khôi phục</button> : <span className="text-xs text-slate-400">Chỉ lưu bản sao</span>}</td><td className="p-3"><button data-delete-guard="ignore" type="button" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100" disabled={busyId===item.id} onClick={()=>void permanentDelete(item)}><Icon name="trash" size={15}/>Xóa vĩnh viễn</button></td></tr>)}
          {!filtered.length && <tr><td colSpan={7} className="p-12 text-center text-slate-500">Thùng rác đang trống hoặc không có dữ liệu phù hợp.</td></tr>}
        </tbody></table></div>
        <div className="divide-y divide-slate-100 md:hidden">
          {filtered.map((item)=><article key={item.id} className="p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><span className="status-pill status-blue">{TYPE_LABELS[item.entityType] || item.entityType}</span><p className="mt-2 break-words font-black text-slate-950">{item.label}</p><p className="mt-1 break-all text-xs text-slate-400">{item.entityId}</p></div><span className="shrink-0 text-right text-[11px] text-slate-400">{new Date(item.deletedAt).toLocaleString("vi-VN")}</span></div><p className="mt-3 text-sm text-slate-600">Người xóa: <strong>{item.deletedByName || "Không rõ"}</strong></p><div className="mt-3 grid gap-2 sm:grid-cols-2">{item.restoreSupported && <button type="button" className="btn-secondary w-full justify-center py-3" disabled={busyId===item.id} onClick={()=>void restore(item)}><Icon name="refresh" size={16}/>Khôi phục</button>}<button data-delete-guard="ignore" type="button" className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 font-black text-rose-700" disabled={busyId===item.id} onClick={()=>void permanentDelete(item)}><Icon name="trash" size={16}/>Xóa vĩnh viễn</button></div></article>)}
          {!filtered.length && <p className="p-10 text-center text-slate-500">Thùng rác đang trống hoặc không có dữ liệu phù hợp.</p>}
        </div>
      </div>}
    </section>
  </main>;
}
