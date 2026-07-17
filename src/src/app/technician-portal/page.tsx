"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PortalHeader } from "@/components/ui/PortalHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";

type Order = { id: string; orderCode: string; customerName: string; customerPhone: string; address?: string | null; serviceType: string; status: string; dueDate?: string | null; machine?: { id: string; buildingPhoto?: string | null; machinePhoto?: string | null } };

type Report = { products: string; note: string; oldCorePhoto: string; newCorePhoto: string; finalPhoto: string; signature: string };
const EMPTY_REPORT: Report = { products: "", note: "", oldCorePhoto: "", newCorePhoto: "", finalPhoto: "", signature: "" };

export default function TechnicianPortalPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [reportOrder, setReportOrder] = useState<Order | null>(null);
  const [report, setReport] = useState<Report>(EMPTY_REPORT);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/agent-portal/orders", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được lệnh");
      setOrders(result.data || []);
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được lệnh" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function update(orderId: string, status: string) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/service-orders/${orderId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được lệnh");
      setNotice({ kind: "success", text: result.message });
      await load();
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được lệnh" }); }
    finally { setBusy(false); }
  }

  async function upload(file: File, field: keyof Pick<Report, "oldCorePhoto" | "newCorePhoto" | "finalPhoto">) {
    setBusy(true);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Tải ảnh thất bại");
      setReport((current) => ({ ...current, [field]: result.url }));
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Tải ảnh thất bại" }); }
    finally { setBusy(false); }
  }

  async function submitReport() {
    if (!reportOrder) return;
    if (!report.oldCorePhoto || !report.newCorePhoto || !report.signature.trim()) {
      setNotice({ kind: "error", text: "Cần ảnh lõi cũ, ảnh lõi mới và xác nhận khách hàng." }); return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/service-orders/${reportOrder.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không gửi được báo cáo");
      setReportOrder(null); setReport(EMPTY_REPORT);
      setNotice({ kind: "success", text: result.message });
      await load();
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không gửi được báo cáo" }); }
    finally { setBusy(false); }
  }

  const stats = useMemo(() => ({ new: orders.filter((item)=>item.status === "ASSIGNED").length, doing: orders.filter((item)=>["ACCEPTED","IN_PROGRESS"].includes(item.status)).length, done: orders.filter((item)=>item.status === "COMPLETED").length }), [orders]);

  return <main className="min-h-screen bg-slate-100"><PortalHeader title="Cổng kỹ thuật viên" subtitle="Chỉ hiển thị lệnh được đại lý giao trực tiếp cho bạn" homeHref="/technician-portal" homeLabel="Lệnh của tôi" onLogout={() => fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"))}><Link href="/scan" className="btn-primary px-4 py-2 font-bold text-white"><Icon name="qr" size={16}/>Quét QR / Kích hoạt máy</Link></PortalHeader><div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">{notice&&<Notice kind={notice.kind}>{notice.text}</Notice>}<section className="surface-card border-2 border-emerald-100 bg-emerald-50/60 p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Nhập dữ liệu máy mới</p><h2 className="mt-1 text-xl font-black text-slate-950">Quét QR để kích hoạt máy mới</h2><p className="mt-1 text-sm leading-6 text-slate-600">Dùng khi KTV nhập thông tin khách hàng, địa chỉ, GPS, ảnh lắp đặt và hoàn tất kích hoạt máy.</p></div><Link href="/scan" className="btn-primary shrink-0 px-5 py-3 font-black text-white"><Icon name="qr" size={18}/>Quét QR / Nhập mã máy</Link></div></section><section className="grid gap-3 sm:grid-cols-3"><MetricCard label="Lệnh mới" value={stats.new} icon="bell" tone="amber"/><MetricCard label="Đang xử lý" value={stats.doing} icon="wrench" tone="blue"/><MetricCard label="Đã hoàn thành" value={stats.done} icon="check" tone="emerald"/></section>{loading?<LoadingState label="Đang tải lệnh được giao..."/>:<section className="space-y-4">{orders.map((order)=><article key={order.id} className="surface-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">{order.orderCode}</h2><StatusBadge value={order.status}/></div><p className="mt-2 font-bold">{order.customerName} · <a href={`tel:${order.customerPhone}`} className="text-emerald-700">{order.customerPhone}</a></p><p className="mt-1 text-sm text-slate-600">{order.address || "Chưa có địa chỉ"}</p><p className="mt-2 text-sm"><strong>Dịch vụ:</strong> {order.serviceType} · <strong>Hạn:</strong> {order.dueDate ? new Date(order.dueDate).toLocaleDateString("vi-VN") : "Chưa xác định"}</p><div className="mt-3 flex flex-wrap gap-3 text-sm"><Link href={`/qr/${order.machine?.id || ""}`} className="font-bold text-blue-700">Máy {order.machine?.id}</Link>{order.machine?.buildingPhoto&&<a href={order.machine.buildingPhoto} target="_blank" className="underline">Ảnh mặt tiền</a>}{order.machine?.machinePhoto&&<a href={order.machine.machinePhoto} target="_blank" className="underline">Ảnh vị trí máy</a>}</div></div><div className="flex min-w-44 flex-col gap-2">{order.status === "ASSIGNED"&&<button type="button" disabled={busy} onClick={()=>void update(order.id,"ACCEPTED")} className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">Nhận lệnh</button>}{order.status === "ACCEPTED"&&<button type="button" disabled={busy} onClick={()=>void update(order.id,"IN_PROGRESS")} className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Bắt đầu xử lý</button>}{order.status === "IN_PROGRESS"&&<button type="button" disabled={busy} onClick={()=>setReportOrder(order)} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Gửi báo cáo</button>}</div></div></article>)}{!orders.length&&<div className="surface-card p-12 text-center text-slate-500"><Icon name="check" size={36} className="mx-auto mb-3"/><p className="font-bold">Bạn chưa có lệnh nào được giao.</p></div>}</section>}</div>{reportOrder&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">{reportOrder.orderCode}</p><h3 className="text-xl font-black">Báo cáo hoàn thành</h3></div><button type="button" onClick={()=>{setReportOrder(null);setReport(EMPTY_REPORT);}} className="icon-button"><Icon name="x" size={18}/></button></div><div className="mt-5 space-y-4"><Upload label="Ảnh lõi cũ" value={report.oldCorePhoto} onFile={(file)=>void upload(file,"oldCorePhoto")}/><Upload label="Ảnh lõi mới" value={report.newCorePhoto} onFile={(file)=>void upload(file,"newCorePhoto")}/><Upload label="Ảnh toàn cảnh sau hoàn thành" value={report.finalPhoto} onFile={(file)=>void upload(file,"finalPhoto")}/><label className="block"><span className="mb-1 block text-sm font-bold">Sản phẩm/vật tư đã dùng</span><input value={report.products} onChange={(event)=>setReport({...report,products:event.target.value})}/></label><label className="block"><span className="mb-1 block text-sm font-bold">Khách hàng xác nhận</span><input value={report.signature} onChange={(event)=>setReport({...report,signature:event.target.value})} placeholder="Nhập họ tên người xác nhận"/></label><label className="block"><span className="mb-1 block text-sm font-bold">Ghi chú</span><textarea value={report.note} onChange={(event)=>setReport({...report,note:event.target.value})}/></label><button type="button" disabled={busy} onClick={()=>void submitReport()} className="btn-primary w-full p-3 font-black text-white disabled:opacity-50">Gửi báo cáo hoàn thành</button></div></div></div>}</main>;
}

function Upload({ label, value, onFile }: { label: string; value: string; onFile: (file: File) => void }) { return <label className="block"><span className="mb-1 block text-sm font-bold">{label}</span><input type="file" accept="image/*" capture="environment" onChange={(event: ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(file)onFile(file);}}/>{value&&<a href={value} target="_blank" className="mt-1 block text-sm font-bold text-emerald-700">Xem ảnh đã tải</a>}</label>; }
