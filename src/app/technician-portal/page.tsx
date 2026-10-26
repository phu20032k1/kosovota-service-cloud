"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PortalHeader } from "@/components/ui/PortalHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { ServiceSignatureCapture } from "@/components/ServiceSignatureCapture";

type Order = { id: string; orderCode: string; customerName: string; customerPhone: string; address?: string | null; serviceType: string; status: string; dueDate?: string | null; machine?: { id: string; buildingPhoto?: string | null; machinePhoto?: string | null } };
type Report = { workDone: string; products: string; oldCorePhoto: string; newCorePhoto: string; finalPhoto: string; customerConfirmationName: string; signatureImage: string; tdsBefore: string; tdsAfter: string };
const EMPTY_REPORT: Report = { workDone: "", products: "", oldCorePhoto: "", newCorePhoto: "", finalPhoto: "", customerConfirmationName: "", signatureImage: "", tdsBefore: "", tdsAfter: "" };
const coreService = (value: string) => /thay\s*lõi|lõi|filter/i.test(value);

export default function TechnicianPortalPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [reportOrder, setReportOrder] = useState<Order | null>(null);
  const [report, setReport] = useState<Report>(EMPTY_REPORT);
  const [reportError, setReportError] = useState("");

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
      setNotice({ kind: "success", text: result.message }); await load();
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được lệnh" }); }
    finally { setBusy(false); }
  }

  async function upload(file: File, field: "oldCorePhoto" | "newCorePhoto" | "finalPhoto") {
    setBusy(true);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Tải ảnh thất bại");
      setReport((current) => ({ ...current, [field]: result.url })); setReportError("");
    } catch (error) { setReportError(error instanceof Error ? error.message : "Tải ảnh thất bại"); }
    finally { setBusy(false); }
  }

  async function submitReport() {
    if (!reportOrder || busy) return;
    const needsCore = coreService(reportOrder.serviceType);
    if (!report.workDone.trim()) return setReportError("Hãy ghi công việc đã làm.");
    if (!report.finalPhoto) return setReportError("Thiếu ảnh máy sau khi làm xong.");
    if (needsCore && (!report.oldCorePhoto || !report.newCorePhoto)) return setReportError("Thay lõi bắt buộc có ảnh lõi cũ và ảnh lõi mới.");
    if (report.tdsBefore === "" || report.tdsAfter === "") return setReportError("Hãy nhập TDS trước và sau.");
    if (!report.customerConfirmationName.trim()) return setReportError("Hãy nhập tên khách hàng xác nhận.");
    if (!report.signatureImage) return setReportError("Khách hàng cần ký trực tiếp hoặc chụp/chọn ảnh chữ ký trước khi gửi.");
    setBusy(true); setReportError("");
    try {
      const response = await fetch(`/api/service-orders/${reportOrder.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        products: report.products,
        note: report.workDone.trim(),
        oldCorePhoto: report.oldCorePhoto,
        newCorePhoto: report.newCorePhoto,
        finalPhoto: report.finalPhoto,
        customerConfirmationName: report.customerConfirmationName.trim(),
        signatureImage: report.signatureImage,
        coreReplacement: needsCore,
        tdsBefore: Number(report.tdsBefore),
        tdsAfter: Number(report.tdsAfter),
      }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không gửi được báo cáo");
      setReportOrder(null); setReport(EMPTY_REPORT);
      setNotice({ kind: "success", text: result.message });
      await load();
    } catch (error) { setReportError(error instanceof Error ? error.message : "Không gửi được báo cáo"); }
    finally { setBusy(false); }
  }

  const stats = useMemo(() => ({ new: orders.filter((item)=>item.status === "ASSIGNED").length, doing: orders.filter((item)=>["ACCEPTED","IN_PROGRESS"].includes(item.status)).length, done: orders.filter((item)=>item.status === "COMPLETED").length }), [orders]);

  return <main className="min-h-screen bg-slate-100"><PortalHeader title="Kỹ thuật viên" subtitle="Lệnh đại lý giao trực tiếp cho bạn" homeHref="/technician-portal" homeLabel="Lệnh của tôi" onLogout={() => fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"))}/><div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-6">{notice&&<Notice kind={notice.kind}>{notice.text}</Notice>}<section className="grid grid-cols-3 gap-3"><MetricCard label="Lệnh mới" value={stats.new} icon="bell" tone="amber"/><MetricCard label="Đang làm" value={stats.doing} icon="wrench" tone="blue"/><MetricCard label="Hoàn thành" value={stats.done} icon="check" tone="emerald"/></section>{loading?<LoadingState label="Đang tải lệnh..."/>:<section className="space-y-3">{orders.filter((o)=>!["CANCELLED"].includes(o.status)).map((order)=><article key={order.id} className="surface-card p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">{order.orderCode}</p><h2 className="mt-1 text-lg font-black">{order.serviceType}</h2></div><StatusBadge value={order.status}/></div><div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm"><p className="font-black">{order.customerName}</p>{order.customerPhone&&<a href={`tel:${order.customerPhone}`} className="block font-bold text-emerald-700">{order.customerPhone}</a>}{order.address&&<p>{order.address}</p>}<p><strong>Giờ hẹn:</strong> {order.dueDate ? new Date(order.dueDate).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Chưa hẹn"}</p></div><div className="mt-4">{order.status === "ACCEPTED"&&<button type="button" disabled={busy} onClick={()=>void update(order.id,"IN_PROGRESS")} className="btn-primary w-full p-3 font-black text-white">Bắt đầu làm</button>}{order.status === "IN_PROGRESS"&&<button type="button" disabled={busy} onClick={()=>{setReportOrder(order);setReport(EMPTY_REPORT);setReportError("");}} className="w-full rounded-xl bg-slate-900 p-3 font-black text-white">Báo cáo hoàn thành</button>}</div></article>)}{!orders.length&&<div className="surface-card p-12 text-center text-slate-500"><Icon name="check" size={34} className="mx-auto mb-2"/><p className="font-bold">Bạn chưa có lệnh được giao.</p></div>}</section>}</div>{reportOrder&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3"><div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black text-emerald-700">{reportOrder.orderCode}</p><h3 className="text-xl font-black">Báo cáo hoàn thành</h3></div><button type="button" disabled={busy} onClick={()=>{setReportOrder(null);setReport(EMPTY_REPORT);setReportError("");}} className="icon-button"><Icon name="x" size={18}/></button></div><div className="mt-5 space-y-4"><label><span className="field-label">Công việc đã làm *</span><textarea rows={3} value={report.workDone} onChange={(e)=>setReport({...report,workDone:e.target.value})} className="w-full"/></label><label><span className="field-label">Vật tư đã thay</span><input value={report.products} onChange={(e)=>setReport({...report,products:e.target.value})} className="w-full"/></label>{coreService(reportOrder.serviceType)&&<><Upload label="Ảnh lõi cũ *" value={report.oldCorePhoto} onFile={(f)=>void upload(f,"oldCorePhoto")}/><Upload label="Ảnh lõi mới *" value={report.newCorePhoto} onFile={(f)=>void upload(f,"newCorePhoto")}/></>}<Upload label="Ảnh máy sau khi làm xong *" value={report.finalPhoto} onFile={(f)=>void upload(f,"finalPhoto")}/><div className="grid grid-cols-2 gap-3"><label><span className="field-label">TDS trước *</span><input type="number" min="0" inputMode="decimal" value={report.tdsBefore} onChange={(e)=>setReport({...report,tdsBefore:e.target.value})}/></label><label><span className="field-label">TDS sau *</span><input type="number" min="0" inputMode="decimal" value={report.tdsAfter} onChange={(e)=>setReport({...report,tdsAfter:e.target.value})}/></label></div><ServiceSignatureCapture customerName={report.customerConfirmationName} signatureImage={report.signatureImage} onCustomerNameChange={(value)=>setReport((current)=>({...current,customerConfirmationName:value}))} onSignatureImageChange={(value)=>setReport((current)=>({...current,signatureImage:value}))} disabled={busy}/>{reportError&&<div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{reportError}</div>}<button type="button" disabled={busy} onClick={()=>void submitReport()} className="btn-primary w-full p-3 font-black text-white disabled:opacity-50">{busy?"Đang gửi...":"Gửi báo cáo hoàn thành"}</button></div></div></div>}</main>;
}
function Upload({ label, value, onFile }: { label: string; value: string; onFile: (file: File) => void }) { return <label className="block"><span className="field-label">{label}</span><input type="file" accept="image/*" capture="environment" onChange={(event: ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(file)onFile(file);}}/>{value&&<a href={value} target="_blank" rel="noreferrer" className="mt-1 block text-sm font-bold text-emerald-700">Xem ảnh đã chọn</a>}</label>; }
