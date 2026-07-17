"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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

type PendingAction =
  | { type: "DELETE"; codes: string[] }
  | { type: "STATUS"; codes: string[]; status: "APPROVED" | "REJECTED" | "SUSPENDED" };


function actionLabel(action: PendingAction | null) {
  if (!action) return "";
  if (action.type === "DELETE") return action.codes.length === 1 ? action.codes[0] : `${action.codes.length} đại lý`;
  if (action.status === "APPROVED") return action.codes.length === 1 ? "duyệt hồ sơ này" : `duyệt ${action.codes.length} hồ sơ`;
  if (action.status === "REJECTED") return action.codes.length === 1 ? "từ chối hồ sơ này" : `từ chối ${action.codes.length} hồ sơ`;
  return action.codes.length === 1 ? "tạm khóa hồ sơ này" : `tạm khóa ${action.codes.length} hồ sơ`;
}

export default function AdminDealersPage() {
  const [items, setItems] = useState<Dealer[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

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

  const filtered = useMemo(() => items.filter((item) => {
    const content = `${item.dealerCode} ${item.name} ${item.representativeName || ""} ${item.phone} ${item.province || ""} ${item.address || ""} ${item.services || ""}`.toLowerCase();
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
    setSelectedCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  async function update(dealerCodes: string[], nextStatus: "APPROVED" | "REJECTED" | "SUSPENDED") {
    if (!dealerCodes.length) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/dealers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dealerCodes.length === 1 ? { dealerCode: dealerCodes[0], status: nextStatus } : { dealerCodes, status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được hồ sơ");
      setNotice({ kind: "success", text: result.message });
      setSelectedCodes((current) => current.filter((code) => !dealerCodes.includes(code)));
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được hồ sơ" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteDealers(dealerCodes: string[]) {
    if (!dealerCodes.length) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/dealers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dealerCodes.length === 1 ? { dealerCode: dealerCodes[0] } : { dealerCodes }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không xóa được đại lý");
      setNotice({ kind: "success", text: result.message });
      setSelectedCodes((current) => current.filter((code) => !dealerCodes.includes(code)));
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không xóa được đại lý" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action.type === "DELETE") await deleteDealers(action.codes);
    else await update(action.codes, action.status);
  }

  const selectedCount = selectedCodes.length;
  const pendingCount = items.filter((item) => item.status === "PENDING").length;

  return <main className="page-shell">
    <OperationsHeader
      title="Hồ sơ đại lý và CTV"
      subtitle="Duyệt, từ chối, tạm khóa và xóa hồ sơ bằng thao tác đơn hoặc hàng loạt"
      actions={<button type="button" onClick={load} className="icon-button" title="Tải lại"><Icon name="refresh" size={18}/></button>}
    />
    <div className="page-container space-y-6">
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng hồ sơ" value={items.length} icon="store" />
        <MetricCard label="Chờ duyệt" value={pendingCount} icon="clock" tone="amber" />
        <MetricCard label="Đã duyệt" value={items.filter((item) => item.status === "APPROVED").length} icon="check" tone="emerald" />
        <MetricCard label="Tạm khóa/Từ chối" value={items.filter((item) => ["SUSPENDED", "REJECTED"].includes(item.status)).length} icon="alert" tone="rose" />
      </section>

      <ImportDealersButton onComplete={load} />

      <section className="surface-card">
        <div className="data-toolbar">
          <div>
            <h2 className="page-section-title">Danh sách hồ sơ</h2>
            <p className="page-section-subtitle">Tìm nhanh theo mã, tên, số điện thoại, tỉnh, địa chỉ hoặc năng lực.</p>
          </div>
          <div className="grid w-full gap-2 md:w-auto md:grid-cols-[minmax(260px,420px)_190px]">
            <label className="relative min-w-0">
              <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm đại lý..." className="pl-10" />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
              <option value="SUSPENDED">Tạm khóa</option>
            </select>
          </div>
        </div>

        <div className="action-bar m-4">
          <label className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-700">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
            Chọn tất cả đang lọc ({filtered.length})
          </label>
          <div className="mobile-stack-actions flex flex-wrap items-center gap-2">
            <span className="status-pill status-slate">Đã chọn: {selectedCount}</span>
            <button type="button" disabled={busy || selectedCount === 0} onClick={() => setPendingAction({ type: "STATUS", codes: selectedCodes, status: "APPROVED" })} className="btn-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50"><Icon name="check" size={16}/>Duyệt hàng loạt</button>
            <button type="button" disabled={busy || selectedCount === 0} onClick={() => setPendingAction({ type: "STATUS", codes: selectedCodes, status: "REJECTED" })} className="warning-button text-sm disabled:opacity-50"><Icon name="alert" size={16}/>Từ chối hàng loạt</button>
            <button type="button" disabled={busy || selectedCount === 0} onClick={() => setPendingAction({ type: "DELETE", codes: selectedCodes })} className="danger-button text-sm disabled:opacity-50"><Icon name="trash" size={16}/>Xóa hàng loạt</button>
          </div>
        </div>

        {loading ? <LoadingState label="Đang tải hồ sơ đại lý..." /> : <div className="divide-y divide-slate-100">
          {filtered.map((dealer) => <article key={dealer.id} className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 gap-3">
                <input type="checkbox" checked={selectedCodes.includes(dealer.dealerCode)} onChange={() => toggleOne(dealer.dealerCode)} className="mt-1 h-5 w-5 shrink-0" aria-label={`Chọn ${dealer.dealerCode}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-black text-slate-950">{dealer.dealerCode} · {dealer.name}</h3>
                    <StatusBadge value={dealer.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{dealer.representativeName || "Chưa có người đại diện"} · <a href={`tel:${dealer.phone}`} className="font-bold text-emerald-700">{dealer.phone}</a></p>
                  <p className="mt-1 text-sm text-slate-600">{dealer.address || "Chưa có địa chỉ"} · {dealer.province || "Chưa có tỉnh"}</p>
                  <p className="mt-2 text-sm leading-6"><strong>Năng lực:</strong> {dealer.services || "Chưa khai báo"}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {dealer.portraitPhoto && <a href={dealer.portraitPhoto} target="_blank" className="btn-secondary px-3 py-2 text-xs"><Icon name="camera" size={15}/>Chân dung</a>}
                    {dealer.storePhoto && <a href={dealer.storePhoto} target="_blank" className="btn-secondary px-3 py-2 text-xs"><Icon name="store" size={15}/>Cửa hàng</a>}
                    {dealer.warehousePhoto && <a href={dealer.warehousePhoto} target="_blank" className="btn-secondary px-3 py-2 text-xs"><Icon name="building" size={15}/>Kho</a>}
                  </div>
                </div>
              </div>
              <div className="mobile-stack-actions flex flex-wrap gap-2 lg:justify-end">
                <Link href={`/admin/dealers/${dealer.id}`} className="btn-secondary text-sm"><Icon name="eye" size={16}/>Xem / sửa chi tiết</Link>
                {dealer.status !== "APPROVED" && <button type="button" disabled={busy} onClick={() => setPendingAction({ type: "STATUS", codes: [dealer.dealerCode], status: "APPROVED" })} className="btn-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50"><Icon name="check" size={16}/>Duyệt</button>}
                {dealer.status === "PENDING" && <button type="button" disabled={busy} onClick={() => setPendingAction({ type: "STATUS", codes: [dealer.dealerCode], status: "REJECTED" })} className="warning-button text-sm disabled:opacity-50"><Icon name="alert" size={16}/>Từ chối</button>}
                {dealer.status === "APPROVED" && <button type="button" disabled={busy} onClick={() => setPendingAction({ type: "STATUS", codes: [dealer.dealerCode], status: "SUSPENDED" })} className="warning-button text-sm disabled:opacity-50"><Icon name="lock" size={16}/>Tạm khóa</button>}
                {dealer.status === "SUSPENDED" && <button type="button" disabled={busy} onClick={() => setPendingAction({ type: "STATUS", codes: [dealer.dealerCode], status: "APPROVED" })} className="btn-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50"><Icon name="check" size={16}/>Mở lại</button>}
                <button type="button" disabled={busy} onClick={() => setPendingAction({ type: "DELETE", codes: [dealer.dealerCode] })} className="ghost-danger text-sm disabled:opacity-50"><Icon name="trash" size={16}/>Xóa</button>
              </div>
            </div>
          </article>)}
          {!filtered.length && <p className="p-10 text-center text-slate-500">Không có hồ sơ phù hợp.</p>}
        </div>}
      </section>
    </div>

    <ConfirmDialog
      open={Boolean(pendingAction)}
      tone={pendingAction?.type === "DELETE" ? "danger" : pendingAction?.status === "APPROVED" ? "info" : "warning"}
      title={pendingAction?.type === "DELETE" ? "Xóa hồ sơ đại lý?" : "Xác nhận cập nhật hồ sơ?"}
      description={pendingAction?.type === "DELETE" ? "Thao tác này xóa hồ sơ đại lý khỏi danh sách. Lịch sử dịch vụ được giữ lại bằng cách bỏ liên kết đại lý; tài khoản đại lý/KTV liên quan sẽ bị khóa." : "Hệ thống sẽ cập nhật trạng thái và gửi thông báo tương ứng cho đại lý. Hãy kiểm tra đúng danh sách trước khi tiếp tục."}
      highlight={actionLabel(pendingAction)}
      confirmLabel={pendingAction?.type === "DELETE" ? "Xóa dữ liệu" : "Xác nhận"}
      busy={busy}
      onCancel={() => setPendingAction(null)}
      onConfirm={() => void confirmAction()}
    />
  </main>;
}
