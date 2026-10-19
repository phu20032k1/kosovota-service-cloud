"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type MaterialSaleLine, type MaterialSaleOrder, type MaterialSaleStatus } from "@/lib/material-sale";

type Item = { id: string; sku: string; name: string; unit: string; salePrice: number };
type Warehouse = { id: string; code: string; name: string; balances: Array<{ itemId: string; quantity: number; reserved: number }> };
type SaleData = { ticketCode: string; order: MaterialSaleOrder; items: Item[]; warehouses: Warehouse[] };

const LABELS: Record<MaterialSaleStatus, string> = {
  DRAFT: "Chờ chốt vật tư", CONFIRMED: "Đã xác nhận đơn", SHIPPED: "Đã xuất kho / đang giao", DELIVERED: "Khách đã nhận", CANCELLED: "Đã hủy",
};
const money = (amount: number) => `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;

export function MaterialSaleEditor({ ticketId, onSaved }: { ticketId: string; onSaved: () => Promise<void> }) {
  const [data, setData] = useState<SaleData | null>(null);
  const [order, setOrder] = useState<MaterialSaleOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotice(null);
    fetch(`/api/material-sales/${encodeURIComponent(ticketId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Không tải được đơn bán vật tư.");
        return result.data as SaleData;
      })
      .then((result) => { if (!cancelled) { setData(result); setOrder(result.order); } })
      .catch((error) => { if (!cancelled) setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được đơn hàng." }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticketId]);

  const editable = order?.status === "DRAFT" || order?.status === "CONFIRMED";
  const total = useMemo(() => (order?.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0), [order]);
  const selectedWarehouse = data?.warehouses.find((item) => item.id === order?.warehouseId);
  const unsavedDetails = Boolean(data && order && (JSON.stringify(order.lines) !== JSON.stringify(data.order.lines) || order.note !== data.order.note));
  function updateLine(index: number, patch: Partial<MaterialSaleLine>) {
    setOrder((current) => current ? { ...current, lines: current.lines.map((line, position) => position === index ? { ...line, ...patch } : line) } : current);
  }
  function addLine() {
    if (!data || !order) return;
    const item = data.items.find((candidate) => !order.lines.some((line) => line.itemId === candidate.id));
    if (!item) return;
    setOrder({ ...order, lines: [...order.lines, { itemId: item.id, sku: item.sku, name: item.name, unit: item.unit, quantity: 1, unitPrice: item.salePrice }] });
  }
  function chooseItem(index: number, itemId: string) {
    const item = data?.items.find((candidate) => candidate.id === itemId);
    if (item) updateLine(index, { itemId: item.id, sku: item.sku, name: item.name, unit: item.unit, unitPrice: item.salePrice });
  }
  async function save(status: MaterialSaleStatus) {
    if (!order || busy) return;
    if (status === "SHIPPED" && !window.confirm("Xác nhận xuất kho? Hệ thống sẽ trừ tồn kho thực tế và không cho sửa đơn sau khi xuất.")) return;
    if (status === "CANCELLED" && !window.confirm("Hủy đơn bán vật tư này?")) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/material-sales/${encodeURIComponent(ticketId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...order, status, expectedUpdatedAt: data?.order.updatedAt ?? null }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không lưu được đơn bán vật tư.");
      setOrder(result.data);
      setData((current) => current ? { ...current, order: result.data } : current);
      setNotice({ kind: "success", text: result.message || "Đã lưu đơn bán vật tư." });
      await onSaved();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không lưu được đơn hàng." });
    } finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Đơn bán lõi / vật liệu</p><h3 className="mt-1 text-lg font-black">Chọn vật tư, báo giá và giao hàng</h3><p className="mt-1 text-xs text-slate-500">Tạo từ kết quả CSKH: khách tự thay. Không tự xuất kho trước khi xác nhận giao.</p></div>
      {order && <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-800">{LABELS[order.status]}</span>}
    </div>
    {loading && <p className="mt-4 text-sm text-slate-500">Đang tải danh mục vật tư...</p>}
    {notice && <p className={`mt-3 rounded-xl p-3 text-sm font-semibold ${notice.kind === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-100 text-emerald-800"}`}>{notice.text}</p>}
    {data && order && <div className="mt-4 space-y-4">
      {!data.items.length && <p className="text-sm text-amber-700">Kho chưa có danh mục vật tư. <Link className="font-bold underline" href="/admin/inventory">Thêm lõi/vật liệu tại Quản lý kho</Link>.</p>}
      {order.lines.map((line, index) => <div key={index} className="rounded-xl border border-slate-200 bg-white p-3">
        <label className="block text-xs font-bold text-slate-600">Vật tư</label>
        <select value={line.itemId} disabled={!editable || busy} onChange={(event) => chooseItem(index, event.target.value)} className="mt-1 w-full">
          {!data.items.some((item) => item.id === line.itemId) && <option value={line.itemId}>{line.sku} · {line.name} (ngừng bán)</option>}
          {data.items.map((item) => <option key={item.id} value={item.id} disabled={order.lines.some((other, position) => position !== index && other.itemId === item.id)}>{item.sku} · {item.name}</option>)}
        </select>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-600">Số lượng ({line.unit})<input type="number" min="1" max="10000" step="1" value={line.quantity} disabled={!editable || busy} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className="mt-1 w-full"/></label>
          <label className="text-xs font-bold text-slate-600">Giá bán (đ)<input type="number" min="0" step="1" value={line.unitPrice} disabled={!editable || busy} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })} className="mt-1 w-full"/></label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2"><strong className="text-sm">{money(line.quantity * line.unitPrice)}</strong>{editable && <button type="button" disabled={busy} onClick={() => setOrder((current) => current ? { ...current, lines: current.lines.filter((_, position) => position !== index) } : current)} className="text-xs font-bold text-rose-700">Bỏ vật tư</button>}</div>
      </div>)}
      {editable && <button type="button" disabled={busy || !data.items.some((item) => !order.lines.some((line) => line.itemId === item.id))} onClick={addLine} className="btn-secondary w-full justify-center disabled:opacity-50">+ Thêm vật tư</button>}
      <div className="rounded-xl bg-white p-4"><div className="flex items-center justify-between gap-3"><span className="font-bold">Tổng tiền</span><strong className="text-xl text-emerald-700">{money(total)}</strong></div></div>
      <label className="block text-xs font-bold text-slate-600">Kho xuất hàng
        <select value={order.warehouseId || ""} disabled={busy || order.status === "SHIPPED" || order.status === "DELIVERED" || order.status === "CANCELLED"} onChange={(event) => setOrder({ ...order, warehouseId: event.target.value || null })} className="mt-1 w-full">
          <option value="">Chọn khi chuẩn bị giao</option>{data.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}
        </select>
      </label>
      {selectedWarehouse && order.lines.length > 0 && order.status !== "SHIPPED" && order.status !== "DELIVERED" && <p className="text-xs text-slate-500">Tồn khả dụng: {order.lines.map((line) => { const balance = selectedWarehouse.balances.find((entry) => entry.itemId === line.itemId); return `${line.name}: ${Math.max(0, (balance?.quantity || 0) - (balance?.reserved || 0))} ${line.unit}`; }).join(" · ")}</p>}
      <label className="block text-xs font-bold text-slate-600">Ghi chú giao hàng<textarea rows={2} value={order.note} disabled={!editable || busy} onChange={(event) => setOrder({ ...order, note: event.target.value })} className="mt-1 w-full" placeholder="Địa chỉ nhận, cách thanh toán, lưu ý cho CSKH..."/></label>
      <div className="flex flex-wrap gap-2">
        {order.status === "DRAFT" && <><button type="button" disabled={busy} onClick={() => void save("DRAFT")} className="btn-secondary">Lưu nháp</button><button type="button" disabled={busy || !order.lines.length} onClick={() => void save("CONFIRMED")} className="btn-primary px-4 py-2 font-bold text-white disabled:opacity-50">Chốt đơn</button></>}
        {order.status === "CONFIRMED" && <><button type="button" disabled={busy} onClick={() => void save("CONFIRMED")} className="btn-secondary">Lưu chỉnh sửa</button><button type="button" disabled={busy || !order.warehouseId || unsavedDetails} onClick={() => void save("SHIPPED")} className="btn-primary px-4 py-2 font-bold text-white disabled:opacity-50">Xuất kho & giao</button></>}
        {order.status === "CONFIRMED" && unsavedDetails && <p className="w-full text-xs font-semibold text-amber-700">Lưu chỉnh sửa vật tư và giá trước khi xuất kho.</p>}
        {order.status === "SHIPPED" && <button type="button" disabled={busy} onClick={() => void save("DELIVERED")} className="btn-primary px-4 py-2 font-bold text-white disabled:opacity-50">Xác nhận đã giao</button>}
        {editable && <button type="button" disabled={busy} onClick={() => void save("CANCELLED")} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">Hủy đơn</button>}
      </div>
      {order.status === "SHIPPED" && <p className="text-xs text-slate-500">Đã xuất kho. Muốn hoàn hàng phải tạo phiếu nhập hoàn riêng tại Quản lý kho.</p>}
    </div>}
  </section>;
}
