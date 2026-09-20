"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type TrashItem = {
  id: string; entityType: string; entityId: string; label: string;
  deletedByName?: string | null; deletedAt: string; restoreSupported: boolean;
};
type NoticeState = { kind: "success" | "error" | "info"; text: string } | null;
type ConfirmState = { mode: "restore" | "delete"; items: TrashItem[] } | null;

const TYPE_LABELS: Record<string, string> = {
  USER: "Tài khoản", CUSTOMER: "Khách hàng", DEALER: "Đại lý / CTV",
  SERVICE_ORDER: "Lệnh dịch vụ", SUPPORT_TICKET: "Yêu cầu",
  MAINTENANCE_SCHEDULE: "Lịch bảo trì",
};

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/trash", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được Thùng rác.");
      setItems(result.data || []);
      setSelected((current) => current.filter((id) => (result.data || []).some((item: TrashItem) => item.id === id)));
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
  const selectedItems = useMemo(() => items.filter((item) => selected.includes(item.id)), [items, selected]);
  const selectedRestorable = selectedItems.filter((item) => item.restoreSupported);
  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selected.includes(item.id));

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function toggleVisible() {
    const visibleIds = filtered.map((item) => item.id);
    setSelected((current) => allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds])));
  }

  async function runAction() {
    if (!confirm?.items.length) return;
    setBusy(true); setNotice(null);
    try {
      const ids = confirm.items.map((item) => item.id);
      const response = confirm.mode === "restore"
        ? await fetch("/api/admin/trash/restore-bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) })
        : await fetch("/api/admin/trash", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không thực hiện được thao tác.");
      setNotice({ kind: result.failed?.length ? "info" : "success", text: result.message });
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      setConfirm(null);
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thực hiện được thao tác." });
    } finally { setBusy(false); }
  }

  const confirmTitle = confirm?.mode === "delete"
    ? (confirm.items.length > 1 ? `Xóa vĩnh viễn ${confirm.items.length} mục?` : "Xóa vĩnh viễn dữ liệu?")
    : (confirm?.items.length && confirm.items.length > 1 ? `Khôi phục ${confirm.items.length} mục?` : "Khôi phục dữ liệu?");
  const confirmHighlight = confirm?.items.length === 1
    ? confirm.items[0].label
    : confirm?.items.length ? `${confirm.items.length} mục đã chọn` : "";

  return <main className="min-h-screen bg-slate-50/70">
    <OperationsHeader title="Thùng rác dữ liệu" subtitle="Kiểm tra, khôi phục hoặc xóa vĩnh viễn dữ liệu đã xóa" />
    <section className="mx-auto max-w-[1480px] space-y-4 p-3 sm:p-5">
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <MetricCard label="Trong thùng rác" value={items.length} icon="trash" tone="rose" />
        <MetricCard label="Có thể khôi phục" value={items.filter((item) => item.restoreSupported).length} icon="refresh" tone="emerald" />
        <MetricCard label="Tài khoản / khách" value={items.filter((item) => ["USER", "CUSTOMER"].includes(item.entityType)).length} icon="users" tone="blue" />
        <MetricCard label="Vận hành / dịch vụ" value={items.filter((item) => !["USER", "CUSTOMER"].includes(item.entityType)).length} icon="database" tone="amber" />
      </div>

      <div className="surface-card space-y-3 p-3 sm:p-4">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_240px_auto]">
          <label className="relative min-w-0"><Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className="w-full pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã, người xóa..." /></label>
          <select className="w-full" value={type} onChange={(event) => setType(event.target.value)}><option value="">Tất cả loại dữ liệu</option>{typeOptions.map((value) => <option key={value} value={value}>{TYPE_LABELS[value] || value}</option>)}</select>
          <button type="button" className="btn-secondary justify-center" onClick={() => { setSearch(""); setType(""); }}><Icon name="x" size={17} />Xóa lọc</button>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex min-h-10 items-center gap-2 px-2 text-sm font-black text-slate-700">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} disabled={!filtered.length} />
            Chọn tất cả đang hiển thị
          </label>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-10 items-center rounded-xl bg-white px-3 text-xs font-black text-slate-600 ring-1 ring-slate-200">{selected.length} đã chọn</span>
            <button type="button" disabled={!selectedRestorable.length || busy} onClick={() => setConfirm({ mode: "restore", items: selectedRestorable })} className="btn-secondary min-h-10 px-3 text-xs font-black disabled:opacity-40"><Icon name="refresh" size={15}/>Khôi phục đã chọn</button>
            <button data-delete-guard="ignore" type="button" disabled={!selectedItems.length || busy} onClick={() => setConfirm({ mode: "delete", items: selectedItems })} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 text-xs font-black text-white shadow-sm hover:bg-rose-700 disabled:opacity-40"><Icon name="trash" size={15}/>Xóa đã chọn</button>
          </div>
        </div>
      </div>

      {loading ? <LoadingState /> : <div className="table-shell overflow-hidden">
        <div className="hidden max-h-[68vh] overflow-auto overscroll-contain [scrollbar-gutter:stable] md:block">
          <table className="min-w-[1050px] text-sm">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(15,23,42,.08)]"><tr>
              <th className="w-12 p-3 text-center"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /></th>
              {["Loại","Dữ liệu","Mã gốc","Người xóa","Thời gian","Thao tác"].map((head)=><th key={head} className="p-3 text-left">{head}</th>)}
            </tr></thead>
            <tbody>{filtered.map((item)=><tr key={item.id} className={selected.includes(item.id) ? "bg-emerald-50/50" : ""}>
              <td className="p-3 text-center"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /></td>
              <td className="p-3"><span className="status-pill status-blue">{TYPE_LABELS[item.entityType] || item.entityType}</span></td>
              <td className="max-w-sm p-3 font-bold text-slate-900">{item.label}</td>
              <td className="max-w-[220px] break-all p-3 text-xs text-slate-500">{item.entityId}</td>
              <td className="p-3">{item.deletedByName || "Không rõ"}</td>
              <td className="whitespace-nowrap p-3 text-xs text-slate-500">{new Date(item.deletedAt).toLocaleString("vi-VN")}</td>
              <td className="p-3"><div className="flex gap-2">
                {item.restoreSupported && <button type="button" className="btn-secondary whitespace-nowrap px-3 py-2 text-xs" disabled={busy} onClick={()=>setConfirm({mode:"restore",items:[item]})}><Icon name="refresh" size={15}/>Khôi phục</button>}
                <button data-delete-guard="ignore" type="button" className="whitespace-nowrap rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100" disabled={busy} onClick={()=>setConfirm({mode:"delete",items:[item]})}><Icon name="trash" size={15}/>Xóa vĩnh viễn</button>
              </div></td>
            </tr>)}
            {!filtered.length && <tr><td colSpan={7} className="p-12 text-center text-slate-500">Thùng rác đang trống hoặc không có dữ liệu phù hợp.</td></tr>}</tbody>
          </table>
        </div>

        <div className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] md:hidden">
          {filtered.map((item)=><article key={item.id} className={`p-3.5 ${selected.includes(item.id) ? "bg-emerald-50/60" : "bg-white"}`}>
            <div className="flex min-w-0 items-start gap-3">
              <input type="checkbox" className="mt-1 shrink-0" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="status-pill status-blue">{TYPE_LABELS[item.entityType] || item.entityType}</span>
                  <span className="text-[11px] font-bold text-slate-400">{new Date(item.deletedAt).toLocaleString("vi-VN")}</span>
                </div>
                <p className="mt-2 break-words text-[15px] font-black text-slate-950">{item.label}</p>
                <p className="mt-1 break-all text-[11px] text-slate-400">{item.entityId}</p>
                <p className="mt-2 text-xs text-slate-600">Người xóa: <strong>{item.deletedByName || "Không rõ"}</strong></p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {item.restoreSupported ? <button type="button" className="btn-secondary min-h-11 justify-center px-2 text-xs" disabled={busy} onClick={()=>setConfirm({mode:"restore",items:[item]})}><Icon name="refresh" size={15}/>Khôi phục</button> : <span className="grid min-h-11 place-items-center rounded-xl bg-slate-50 px-2 text-center text-[11px] font-bold text-slate-400">Chỉ lưu bản sao</span>}
              <button data-delete-guard="ignore" type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-2 text-xs font-black text-rose-700" disabled={busy} onClick={()=>setConfirm({mode:"delete",items:[item]})}><Icon name="trash" size={15}/>Xóa vĩnh viễn</button>
            </div>
          </article>)}
          {!filtered.length && <p className="p-10 text-center text-slate-500">Thùng rác đang trống hoặc không có dữ liệu phù hợp.</p>}
        </div>
      </div>}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirmTitle}
        description={confirm?.mode === "delete" ? "Thao tác này xóa bản lưu khỏi Thùng rác và không thể hoàn tác. Hãy kiểm tra kỹ dữ liệu đã chọn." : "Dữ liệu sẽ được đưa trở lại hệ thống. Nếu mã hoặc dữ liệu liên quan đã được tạo lại, hệ thống sẽ giữ an toàn và báo mục không thể khôi phục."}
        highlight={confirmHighlight}
        confirmLabel={confirm?.mode === "delete" ? "Xóa vĩnh viễn" : "Khôi phục"}
        cancelLabel="Hủy"
        tone={confirm?.mode === "delete" ? "danger" : "info"}
        busy={busy}
        icon={confirm?.mode === "delete" ? "trash" : "refresh"}
        onConfirm={() => void runAction()}
        onCancel={() => { if (!busy) setConfirm(null); }}
      />
    </section>
  </main>;
}
