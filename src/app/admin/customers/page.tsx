"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ImportCustomersButton from "@/components/ImportCustomersButton";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { readApiResponse } from "@/lib/client-api";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  segment?: string | null;
  satisfaction?: number | null;
  nextContactAt?: string | null;
  owner?: { name: string } | null;
  machines: { id: string; model: string; name?: string | null }[];
  _count: { activities: number; tickets: number };
};
type EditForm = { name: string; phone: string; address: string; segment: string; satisfaction: string };

const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("vi-VN") : "—";

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [form, setForm] = useState<EditForm>({ name: "", phone: "", address: "", segment: "STANDARD", satisfaction: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (segment !== "ALL") params.set("segment", segment);
      const response = await fetch(`/api/crm/customers?${params}`, { cache: "no-store" });
      const result = await readApiResponse<{ customers: Customer[] }>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không tải được khách hàng");
      const next = result.data.customers || [];
      setItems(next);
      setSelected((current) => current.filter((id) => next.some((item) => item.id === id)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được khách hàng");
    } finally {
      setLoading(false);
    }
  }, [query, segment]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const stats = useMemo(() => ({
    total: items.length,
    vip: items.filter((item) => item.segment === "VIP").length,
    follow: items.filter((item) => item.nextContactAt).length,
    risk: items.filter((item) => (item.satisfaction || 5) <= 2 || item._count.tickets > 0).length,
  }), [items]);

  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));
  const toggleAll = () => setSelected(allSelected ? [] : items.map((item) => item.id));
  const toggleOne = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm({ name: customer.name, phone: customer.phone, address: customer.address || "", segment: customer.segment || "STANDARD", satisfaction: customer.satisfaction ? String(customer.satisfaction) : "" });
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/crm/customers/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone, address: form.address, segment: form.segment, ...(form.satisfaction ? { satisfaction: Number(form.satisfaction) } : {}) }),
      });
      const result = await readApiResponse<Customer>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không sửa được khách hàng");
      setMessage(result.message || "Đã cập nhật khách hàng.");
      setEditing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không sửa được khách hàng");
    } finally { setBusy(false); }
  }

  async function confirmDelete() {
    const ids = deleteIds || [];
    setDeleteIds(null);
    if (!ids.length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/crm/customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids.length === 1 ? { customerId: ids[0] } : { customerIds: ids }),
      });
      const result = await readApiResponse<{ deleted: number }>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không xóa được khách hàng");
      setMessage(result.message || "Đã xóa khách hàng.");
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xóa được khách hàng");
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen">
    <OperationsHeader title="Khách hàng 360°" subtitle="Sửa, xóa từng hồ sơ hoặc xử lý hàng loạt" />
    <div className="page-container space-y-6">
      {message && <Notice kind="success">{message}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Khách hàng" value={stats.total} icon="users" />
        <MetricCard label="Khách VIP" value={stats.vip} icon="star" tone="violet" />
        <MetricCard label="Có lịch liên hệ" value={stats.follow} icon="phone" tone="amber" />
        <MetricCard label="Cần quan tâm" value={stats.risk} icon="alert" tone="rose" />
      </section>

      <ImportCustomersButton onComplete={load} />

      <section className="surface-card overflow-hidden">
        <div className="data-toolbar">
          <label className="relative min-w-[260px] flex-1"><Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, số điện thoại hoặc địa chỉ" className="pl-10" /></label>
          <select value={segment} onChange={(event) => setSegment(event.target.value)} className="max-w-52"><option value="ALL">Tất cả phân khúc</option><option value="STANDARD">Tiêu chuẩn</option><option value="VIP">VIP</option><option value="AT_RISK">Có nguy cơ</option><option value="INTERNAL">Nội bộ</option></select>
        </div>

        <div className="action-bar m-4">
          <label className="inline-flex items-center gap-2 text-sm font-black"><input type="checkbox" checked={allSelected} onChange={toggleAll} />Chọn tất cả ({items.length})</label>
          <div className="flex flex-wrap gap-2"><span className="status-pill status-slate">Đã chọn: {selected.length}</span><button type="button" disabled={!selected.length || busy} onClick={() => setDeleteIds(selected)} className="danger-button text-sm disabled:opacity-50"><Icon name="trash" size={16} />Xóa đã chọn</button><button type="button" disabled={!items.length || busy} onClick={() => setDeleteIds(items.map((item) => item.id))} className="ghost-danger text-sm disabled:opacity-50">Xóa toàn bộ đang lọc</button></div>
        </div>

        {loading ? <LoadingState label="Đang tải khách hàng..." /> : <div className="admin-data-scroll">
          <table className="min-w-[1180px] w-full text-sm">
            <thead><tr>{["Chọn", "Khách hàng", "Phân khúc", "Thiết bị", "Tương tác", "Ticket", "CSKH", "Liên hệ tiếp", "Đánh giá", "Thao tác"].map((header) => <th key={header} className="p-3 text-left">{header}</th>)}</tr></thead>
            <tbody>{items.map((customer) => <tr key={customer.id} className="border-b align-top hover:bg-slate-50">
              <td className="p-3"><input type="checkbox" checked={selected.includes(customer.id)} onChange={() => toggleOne(customer.id)} /></td>
              <td className="p-3"><strong>{customer.name}</strong><div><a href={`tel:${customer.phone}`} className="text-emerald-700">{customer.phone}</a></div><div className="max-w-xs truncate text-xs text-slate-500">{customer.address || "Chưa có địa chỉ"}</div></td>
              <td className="p-3"><span className="status-badge badge-slate">{customer.segment || "STANDARD"}</span></td>
              <td className="p-3"><strong>{customer.machines.length}</strong><div className="max-w-64 text-xs text-slate-500">{customer.machines.slice(0, 3).map((machine) => machine.name || machine.model || machine.id).join(", ")}</div></td>
              <td className="p-3 font-bold">{customer._count.activities}</td><td className="p-3 font-bold">{customer._count.tickets}</td><td className="p-3">{customer.owner?.name || "Chưa giao"}</td><td className="p-3">{date(customer.nextContactAt)}</td><td className="p-3 font-black">{customer.satisfaction ? `${customer.satisfaction}/5` : "—"}</td>
              <td className="sticky right-0 bg-white p-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,.4)]"><div className="flex gap-2 whitespace-nowrap"><Link href={`/admin/customers/${customer.id}`} className="btn-secondary px-3 py-2 text-xs"><Icon name="eye" size={15} />Xem</Link><button type="button" onClick={() => openEdit(customer)} className="btn-secondary px-3 py-2 text-xs"><Icon name="settings" size={15} />Sửa</button><button type="button" onClick={() => setDeleteIds([customer.id])} className="ghost-danger px-3 py-2 text-xs"><Icon name="trash" size={15} />Xóa</button></div></td>
            </tr>)}{!items.length && <tr><td colSpan={10} className="p-10 text-center text-slate-500">Không có khách hàng phù hợp.</td></tr>}</tbody>
          </table>
        </div>}
      </section>
    </div>

    {editing && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><div className="modal-panel max-w-2xl"><div className="modal-header"><div><p className="eyebrow">Khách hàng</p><h2 className="mt-1 text-2xl font-black">Sửa thông tin</h2></div><button type="button" onClick={() => setEditing(null)} className="icon-button"><Icon name="x" size={18} /></button></div><div className="modal-body grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-bold">Tên</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span className="mb-2 block text-sm font-bold">Số điện thoại</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, "") })} /></label><label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold">Địa chỉ</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label><label><span className="mb-2 block text-sm font-bold">Phân khúc</span><select value={form.segment} onChange={(event) => setForm({ ...form, segment: event.target.value })}><option value="STANDARD">Tiêu chuẩn</option><option value="VIP">VIP</option><option value="AT_RISK">Có nguy cơ</option><option value="INTERNAL">Nội bộ</option></select></label><label><span className="mb-2 block text-sm font-bold">Đánh giá</span><select value={form.satisfaction} onChange={(event) => setForm({ ...form, satisfaction: event.target.value })}><option value="">Chưa đánh giá</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label></div><div className="modal-footer"><button type="button" onClick={() => setEditing(null)} className="btn-secondary">Hủy</button><button type="button" disabled={busy} onClick={() => void saveEdit()} className="btn-primary px-5 py-3 font-black text-white disabled:opacity-50">Lưu thay đổi</button></div></div></div>}

    <ConfirmDialog open={Boolean(deleteIds)} tone="danger" title={deleteIds?.length === 1 ? "Xóa khách hàng?" : "Xóa nhiều khách hàng?"} description="Hồ sơ CRM và lịch sử tương tác sẽ bị xóa. Máy và Ticket vẫn được giữ lại nhưng sẽ được tháo liên kết khách hàng." highlight={deleteIds?.length === 1 ? items.find((item) => item.id === deleteIds[0])?.name || "1 khách hàng" : `${deleteIds?.length || 0} khách hàng`} confirmLabel="Xóa dữ liệu" busy={busy} onCancel={() => setDeleteIds(null)} onConfirm={() => void confirmDelete()} />
  </main>;
}
