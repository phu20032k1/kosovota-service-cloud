"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import ImportDealersButton from "@/components/ImportDealersButton";

type Dealer = {
  id: string;
  dealerCode: string;
  name: string;
  representativeName?: string | null;
  phone: string;
  province?: string | null;
  address?: string | null;
  services?: string | null;
  status: string;
  technicianCount?: number | null;
  portraitPhoto?: string | null;
  storePhoto?: string | null;
  warehousePhoto?: string | null;
  createdAt: string;
  serviceOrders?: { id: string; status: string }[];
};

function includesCode(codes: string[], code: string) {
  return codes.includes(code);
}

export default function AdminDealersPage() {
  const [items, setItems] = useState<Dealer[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dealers", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được đại lý");
      const nextItems = result.data || [];
      setItems(nextItems);
      setSelectedCodes((current) => current.filter((code) => nextItems.some((item: Dealer) => item.dealerCode === code)));
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được đại lý" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function update(dealerCodes: string | string[], nextStatus: string) {
    const codes = Array.isArray(dealerCodes) ? dealerCodes : [dealerCodes];
    if (!codes.length) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/dealers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(codes.length === 1 ? { dealerCode: codes[0], status: nextStatus } : { dealerCodes: codes, status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được hồ sơ");
      setNotice({ kind: "success", text: result.message });
      setSelectedCodes((current) => current.filter((code) => !codes.includes(code)));
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được hồ sơ" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteDealers(dealerCodes: string | string[]) {
    const codes = Array.isArray(dealerCodes) ? dealerCodes : [dealerCodes];
    if (!codes.length) return;
    const label = codes.length === 1 ? codes[0] : `${codes.length} đại lý đã chọn`;
    if (!window.confirm(`Xóa ${label}? Lịch sử dịch vụ sẽ được giữ lại nhưng bỏ liên kết đại lý.`)) return;

    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/dealers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(codes.length === 1 ? { dealerCode: codes[0] } : { dealerCodes: codes }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không xóa được đại lý");
      setNotice({ kind: "success", text: result.message });
      setSelectedCodes((current) => current.filter((code) => !codes.includes(code)));
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không xóa được đại lý" });
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => items.filter((item) => {
    const content = `${item.dealerCode} ${item.name} ${item.representativeName || ""} ${item.phone} ${item.province || ""}`.toLowerCase();
    return (status === "ALL" || item.status === status) && (!query.trim() || content.includes(query.trim().toLowerCase()));
  }), [items, query, status]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((dealer) => selectedCodes.includes(dealer.dealerCode));
  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedCodes((current) => current.filter((code) => !filtered.some((dealer) => dealer.dealerCode === code)));
      return;
    }
    setSelectedCodes((current) => [...new Set([...current, ...filtered.map((dealer) => dealer.dealerCode)])]);
  }

  function toggleOne(code: string) {
    setSelectedCodes((current) => includesCode(current, code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  return <main className="min-h-screen bg-slate-100">
    <OperationsHeader
      title="Hồ sơ đại lý và CTV"
      subtitle="Admin là cấp duyệt cuối; đã bổ sung duyệt, từ chối và xóa hàng loạt"
      actions={<button type="button" onClick={load} className="icon-button" title="Tải lại"><Icon name="refresh" size={18}/></button>}
    />
    <div className="page-container space-y-6">
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng hồ sơ" value={items.length} icon="store" />
        <MetricCard label="Chờ duyệt" value={items.filter((item) => item.status === "PENDING").length} icon="clock" tone="amber" />
        <MetricCard label="Đã duyệt" value={items.filter((item) => item.status === "APPROVED").length} icon="check" tone="emerald" />
        <MetricCard label="Tạm khóa/Từ chối" value={items.filter((item) => ["SUSPENDED", "REJECTED"].includes(item.status)).length} icon="alert" tone="rose" />
      </section>

      <ImportDealersButton onComplete={load} />

      <section className="surface-card">
        <div className="data-toolbar">
          <div className="relative min-w-[260px] max-w-xl flex-1">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã, tên, số điện thoại hoặc tỉnh" className="pl-10" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-48">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Từ chối</option>
            <option value="SUSPENDED">Tạm khóa</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
            Chọn tất cả đang lọc ({filtered.length})
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-500">Đã chọn: {selectedCodes.length}</span>
            <button type="button" disabled={busy || selectedCodes.length === 0} onClick={() => void update(selectedCodes, "APPROVED")} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Duyệt hàng loạt</button>
            <button type="button" disabled={busy || selectedCodes.length === 0} onClick={() => void update(selectedCodes, "REJECTED")} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Từ chối hàng loạt</button>
            <button type="button" disabled={busy || selectedCodes.length === 0} onClick={() => void deleteDealers(selectedCodes)} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">Xóa hàng loạt</button>
          </div>
        </div>

        {loading ? <LoadingState label="Đang tải hồ sơ đại lý..." /> : <div className="divide-y">
          {filtered.map((dealer) => <article key={dealer.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex min-w-0 flex-1 gap-3">
                <input
                  type="checkbox"
                  checked={selectedCodes.includes(dealer.dealerCode)}
                  onChange={() => toggleOne(dealer.dealerCode)}
                  className="mt-1 h-5 w-5 shrink-0"
                  aria-label={`Chọn ${dealer.dealerCode}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black">{dealer.dealerCode} · {dealer.name}</h2>
                    <StatusBadge value={dealer.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{dealer.representativeName || "Chưa có người đại diện"} · <a href={`tel:${dealer.phone}`} className="text-emerald-700">{dealer.phone}</a></p>
                  <p className="mt-1 text-sm text-slate-600">{dealer.address || "Chưa có địa chỉ"} · {dealer.province || "Chưa có tỉnh"}</p>
                  <p className="mt-2 text-sm"><strong>Năng lực:</strong> {dealer.services || "Chưa khai báo"}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {dealer.portraitPhoto && <a href={dealer.portraitPhoto} target="_blank" className="font-bold text-blue-700">Ảnh chân dung</a>}
                    {dealer.storePhoto && <a href={dealer.storePhoto} target="_blank" className="font-bold text-blue-700">Ảnh cửa hàng</a>}
                    {dealer.warehousePhoto && <a href={dealer.warehousePhoto} target="_blank" className="font-bold text-blue-700">Ảnh kho</a>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {dealer.status !== "APPROVED" && <button type="button" disabled={busy} onClick={() => void update(dealer.dealerCode, "APPROVED")} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50">Duyệt</button>}
                {dealer.status === "PENDING" && <button type="button" disabled={busy} onClick={() => void update(dealer.dealerCode, "REJECTED")} className="rounded-xl bg-rose-600 px-4 py-2 font-bold text-white disabled:opacity-50">Từ chối</button>}
                {dealer.status === "APPROVED" && <button type="button" disabled={busy} onClick={() => void update(dealer.dealerCode, "SUSPENDED")} className="rounded-xl bg-amber-600 px-4 py-2 font-bold text-white disabled:opacity-50">Tạm khóa</button>}
                {dealer.status === "SUSPENDED" && <button type="button" disabled={busy} onClick={() => void update(dealer.dealerCode, "APPROVED")} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50">Mở lại</button>}
                <button type="button" disabled={busy} onClick={() => void deleteDealers(dealer.dealerCode)} className="rounded-xl border border-rose-200 px-4 py-2 font-bold text-rose-700 disabled:opacity-50"><Icon name="x" size={16}/> Xóa</button>
              </div>
            </div>
          </article>)}
          {!filtered.length && <p className="p-10 text-center text-slate-500">Không có hồ sơ phù hợp.</p>}
        </div>}
      </section>
    </div>
  </main>;
}
