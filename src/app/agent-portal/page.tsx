"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PortalHeader } from "@/components/ui/PortalHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Order = {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  address?: string | null;
  serviceType: string;
  status: string;
  dueDate?: string | null;
  serviceFee?: number | null;
  paymentStatus?: string;
  machine?: { id: string; buildingPhoto?: string | null; machinePhoto?: string | null };
  technician?: { id: string; name: string; phone: string } | null;
};
type Technician = { id: string; name: string; phone: string; active: boolean };
type Dealer = { id: string; dealerCode: string; name: string; phone: string };
type Summary = { revenue: number; paid: number; pending: number };
type InventoryOption = { itemId: string; sku: string; name: string; unit: string; available: number };
type MaterialRow = { itemId: string; quantity: number };

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa xác định";
}
function money(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

export default function AgentPortalPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [summary, setSummary] = useState<Summary>({ revenue: 0, paid: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reportOrder, setReportOrder] = useState<Order | null>(null);
  const [rejectOrder, setRejectOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState("Bận");
  const [report, setReport] = useState({ products: "", note: "", oldCorePhoto: "", newCorePhoto: "", finalPhoto: "", signature: "" });
  const [uploading, setUploading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryOption[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/agent-portal/orders", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được dữ liệu");
      setDealer(result.dealer);
      setOrders(result.data || []);
      setSummary(result.summary || { revenue: 0, paid: 0, pending: 0 });
      const [inventoryResponse, teamResponse] = await Promise.all([
        fetch("/api/inventory", { cache: "no-store" }),
        fetch("/api/dealer/team", { cache: "no-store" }),
      ]);
      const inventoryResult = await inventoryResponse.json();
      const teamResult = await teamResponse.json();
      if (teamResponse.ok && teamResult.success) setTechnicians((teamResult.data || []).filter((item: Technician) => item.active));
      if (inventoryResponse.ok && inventoryResult.success) {
        const options: InventoryOption[] = (inventoryResult.data?.warehouses || []).flatMap((warehouse: { balances?: { itemId: string; quantity: number; reserved: number; item: { sku: string; name: string; unit: string } }[] }) =>
          (warehouse.balances || []).map((balance) => ({
            itemId: balance.itemId,
            sku: balance.item.sku,
            name: balance.item.name,
            unit: balance.item.unit,
            available: Math.max(0, balance.quantity - balance.reserved),
          })).filter((item: InventoryOption) => item.available > 0),
        );
        setInventoryItems(options);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  async function updateOrder(orderId: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/service-orders/${orderId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được lệnh");
    await loadOrders();
  }

  async function assignTechnician(orderId: string, technicianId: string) {
    const response = await fetch(`/api/service-orders/${orderId}/assign-technician`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ technicianId: technicianId || null }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) { setMessage(result.message || "Không giao được KTV"); return; }
    setMessage(result.message);
    await loadOrders();
  }

  async function uploadFile(file: File, field: "oldCorePhoto" | "newCorePhoto" | "finalPhoto") {
    setUploading(true);
    try {
      const data = new FormData(); data.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Tải ảnh thất bại");
      setReport((current) => ({ ...current, [field]: result.url }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tải ảnh thất bại");
    } finally { setUploading(false); }
  }

  async function submitReport() {
    if (!reportOrder) return;
    if (!report.oldCorePhoto || !report.newCorePhoto || !report.signature.trim()) {
      setMessage("Cần ảnh lõi cũ, ảnh lõi mới và chữ ký khách hàng."); return;
    }
    const response = await fetch(`/api/service-orders/${reportOrder.id}/report`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...report, materials }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) { setMessage(result.message || "Không gửi được báo cáo"); return; }
    setReportOrder(null);
    setReport({ products: "", note: "", oldCorePhoto: "", newCorePhoto: "", finalPhoto: "", signature: "" });
    setMaterials([]);
    setMessage("Báo cáo đã được ghi nhận và lệnh đã hoàn thành.");
    await loadOrders();
  }

  const stats = useMemo(() => ({
    assigned: orders.filter((item) => item.status === "ASSIGNED").length,
    processing: orders.filter((item) => ["ACCEPTED", "IN_PROGRESS"].includes(item.status)).length,
    completed: orders.filter((item) => item.status === "COMPLETED").length,
  }), [orders]);

  return (
    <main className="min-h-screen bg-slate-100">
      <PortalHeader title="Cổng thông tin đại lý" subtitle={dealer ? `${dealer.dealerCode} · ${dealer.name}` : "Tài khoản chưa liên kết hồ sơ đại lý"} homeHref="/agent-portal" homeLabel="Lệnh dịch vụ" onLogout={() => fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"))}>
        <Link href="/agent-portal/team" className="btn-secondary"><Icon name="users" size={16}/>Đội KTV</Link>
        <Link href="/agent-portal/inventory" className="btn-secondary"><Icon name="package" size={16}/>Kho vật tư</Link>
        <Link href="/agent-portal/payments" className="btn-secondary"><Icon name="wallet" size={16}/>Đối soát</Link>
      </PortalHeader>

      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {message && <Notice kind="success">{message}</Notice>}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Lệnh mới" value={stats.assigned} icon="bell" tone="amber" />
          <MetricCard label="Đang xử lý" value={stats.processing} icon="wrench" tone="blue" />
          <MetricCard label="Hoàn thành" value={stats.completed} icon="check" tone="emerald" />
          <MetricCard label="Doanh thu dự kiến" value={money(summary.revenue)} icon="wallet" tone="violet" />
        </section>
        <section className="grid gap-4 md:grid-cols-2"><article className="surface-card p-5"><p className="font-bold text-slate-500">Đã thanh toán</p><p className="mt-1 text-2xl font-black text-emerald-700">{money(summary.paid)}</p></article><article className="surface-card p-5"><p className="font-bold text-slate-500">Chờ duyệt thanh toán</p><p className="mt-1 text-2xl font-black text-amber-700">{money(summary.pending)}</p></article></section>

        <section className="table-shell">
          <div className="border-b p-5"><h2 className="text-xl font-black">Lệnh dịch vụ được giao</h2></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left"><tr>{["Mã lệnh", "Khách hàng", "Địa chỉ", "Thiết bị", "Dịch vụ", "KTV phụ trách", "Hạn xử lý", "Trạng thái", "Thao tác"].map((item) => <th key={item} className="p-3">{item}</th>)}</tr></thead><tbody>
            {orders.map((order) => <tr key={order.id} className="border-b align-top"><td className="p-3 font-black">{order.orderCode}</td><td className="p-3"><strong>{order.customerName}</strong><br/><a href={`tel:${order.customerPhone}`} className="text-emerald-700">{order.customerPhone}</a></td><td className="max-w-xs p-3">{order.address || "Chưa cập nhật"}</td><td className="p-3"><Link href={`/qr/${order.machine?.id || ""}`} className="font-bold text-blue-700">{order.machine?.id}</Link><div className="mt-2 flex gap-2">{order.machine?.buildingPhoto && <a href={order.machine.buildingPhoto} target="_blank" className="text-xs underline">Mặt tiền</a>}{order.machine?.machinePhoto && <a href={order.machine.machinePhoto} target="_blank" className="text-xs underline">Vị trí máy</a>}</div></td><td className="p-3">{order.serviceType}</td><td className="min-w-48 p-3"><select value={order.technician?.id || ""} onChange={(event) => void assignTechnician(order.id, event.target.value)} disabled={["COMPLETED","CANCELLED"].includes(order.status)} className="rounded-lg border p-2 text-xs"><option value="">Chưa giao KTV</option>{technicians.map((technician)=><option key={technician.id} value={technician.id}>{technician.name} · {technician.phone}</option>)}</select></td><td className="p-3">{formatDate(order.dueDate)}</td><td className="p-3"><StatusBadge value={order.status}/></td><td className="p-3"><div className="flex min-w-40 flex-col gap-2">
              {order.status === "ASSIGNED" && <><button type="button" onClick={() => updateOrder(order.id, { status: "ACCEPTED" }).catch((e: Error) => setMessage(e.message))} className="rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white">Đồng ý</button><button type="button" onClick={() => setRejectOrder(order)} className="rounded-lg bg-rose-600 px-3 py-2 font-bold text-white">Từ chối</button></>}
              {order.status === "ACCEPTED" && <button type="button" onClick={() => updateOrder(order.id, { status: "IN_PROGRESS" }).catch((e: Error) => setMessage(e.message))} className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white">Bắt đầu xử lý</button>}
              {order.status === "IN_PROGRESS" && <button type="button" onClick={() => setReportOrder(order)} className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white">Gửi báo cáo</button>}
            </div></td></tr>)}
            {!loading && orders.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-slate-500">Chưa có lệnh dịch vụ.</td></tr>}
          </tbody></table></div>
        </section>
      </div>

      {rejectOrder && <Modal title={`Từ chối ${rejectOrder.orderCode}`} onClose={() => setRejectOrder(null)}><select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-full rounded-xl border p-3"><option>Bận</option><option>Xa quá</option><option>Không đúng chuyên môn</option><option>Thiếu vật tư</option><option>Khác</option></select><button type="button" onClick={() => updateOrder(rejectOrder.id, { status: "NEW", dealerId: null, rejectReason }).then(() => setRejectOrder(null)).catch((e: Error) => setMessage(e.message))} className="mt-4 w-full rounded-xl bg-rose-600 p-3 font-bold text-white">Xác nhận từ chối</button></Modal>}
      {reportOrder && <Modal title={`Báo cáo ${reportOrder.orderCode}`} onClose={() => { setReportOrder(null); setMaterials([]); }}><div className="space-y-4">
        <Field label="Vật tư xuất từ kho đại lý">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {materials.map((row, index) => {
              const selected = inventoryItems.find((item) => item.itemId === row.itemId);
              return <div key={`${row.itemId}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_110px_44px]">
                <select value={row.itemId} onChange={(event) => setMaterials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, itemId: event.target.value } : item))} className="rounded-lg border bg-white p-2.5">
                  <option value="">Chọn vật tư</option>{inventoryItems.map((item) => <option key={item.itemId} value={item.itemId}>{item.sku} · {item.name} · còn {item.available} {item.unit}</option>)}
                </select>
                <input type="number" min={1} max={selected?.available || undefined} value={row.quantity} onChange={(event) => setMaterials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item))} className="rounded-lg border bg-white p-2.5" aria-label="Số lượng vật tư"/>
                <button type="button" onClick={() => setMaterials((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="icon-button" title="Bỏ vật tư"><Icon name="x" size={17}/></button>
              </div>;
            })}
            <button type="button" disabled={!inventoryItems.length} onClick={() => setMaterials((current) => [...current, { itemId: inventoryItems.find((item) => !current.some((row) => row.itemId === item.itemId))?.itemId || inventoryItems[0]?.itemId || "", quantity: 1 }])} className="btn-secondary w-full justify-center disabled:opacity-50"><Icon name="plus" size={16}/>{inventoryItems.length ? "Thêm vật tư đã sử dụng" : "Kho chưa có vật tư khả dụng"}</button>
            <p className="text-xs text-slate-500">Khi gửi báo cáo, hệ thống kiểm tra tồn rồi tự tạo phiếu xuất gắn với lệnh này.</p>
          </div>
        </Field>
        <Field label="Mô tả sản phẩm/vật tư khác"><input value={report.products} onChange={(e) => setReport((c) => ({ ...c, products: e.target.value }))} placeholder="Chỉ nhập khi có vật tư chưa nằm trong kho" className="w-full rounded-xl border p-3" /></Field><UploadField label="Ảnh lõi cũ" value={report.oldCorePhoto} onChange={(file) => uploadFile(file, "oldCorePhoto")} /><UploadField label="Ảnh lõi mới" value={report.newCorePhoto} onChange={(file) => uploadFile(file, "newCorePhoto")} /><UploadField label="Ảnh toàn cảnh sau hoàn thành" value={report.finalPhoto} onChange={(file) => uploadFile(file, "finalPhoto")} /><Field label="Xác nhận chữ ký khách hàng"><input value={report.signature} onChange={(e) => setReport((c) => ({ ...c, signature: e.target.value }))} placeholder="Nhập họ tên khách hàng đã xác nhận" className="w-full rounded-xl border p-3" /></Field><Field label="Ghi chú"><textarea value={report.note} onChange={(e) => setReport((c) => ({ ...c, note: e.target.value }))} className="w-full rounded-xl border p-3" /></Field><button type="button" disabled={uploading} onClick={submitReport} className="w-full rounded-xl bg-emerald-600 p-3 font-black text-white disabled:opacity-50">{uploading ? "Đang tải ảnh..." : "Gửi báo cáo hoàn thành"}</button></div></Modal>}
    </main>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6"><div className="mb-5 flex justify-between gap-4"><h3 className="text-xl font-black">{title}</h3><button type="button" onClick={onClose} className="icon-button"><Icon name="x" size={18}/></button></div>{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-sm font-bold">{label}</span>{children}</label>; }
function UploadField({ label, value, onChange }: { label: string; value: string; onChange: (file: File) => void }) { return <Field label={label}><input type="file" accept="image/*" capture="environment" onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) onChange(file); }} className="w-full rounded-xl border p-3" />{value && <a href={value} target="_blank" className="mt-1 block text-sm font-bold text-emerald-700">Xem ảnh đã tải</a>}</Field>; }
