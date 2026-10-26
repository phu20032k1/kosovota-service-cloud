"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PortalHeader } from "@/components/ui/PortalHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ServiceSignatureCapture } from "@/components/ServiceSignatureCapture";

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
  area?: string;
  distanceKm?: number | null;
  machine?: { id: string; buildingPhoto?: string | null; machinePhoto?: string | null };
  technician?: { id: string; name: string; phone: string } | null;
};
type Technician = { id: string; name: string; phone: string; active: boolean };
type Dealer = { id: string; dealerCode: string; name: string; phone: string };
type Summary = { revenue: number; paid: number; pending: number };
type Tab = "waiting" | "doing" | "recent";
type Report = { workDone: string; products: string; oldCorePhoto: string; newCorePhoto: string; finalPhoto: string; customerConfirmationName: string; signatureImage: string; tdsBefore: string; tdsAfter: string };
const EMPTY_REPORT: Report = { workDone: "", products: "", oldCorePhoto: "", newCorePhoto: "", finalPhoto: "", customerConfirmationName: "", signatureImage: "", tdsBefore: "", tdsAfter: "" };

function money(value: number) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value); }
function dateTime(value?: string | null) { return value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Chưa hẹn"; }
function isCoreService(value: string) { return /lõi|filter|thay lõi/i.test(value); }

export default function AgentPortalPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [summary, setSummary] = useState<Summary>({ revenue: 0, paid: 0, pending: 0 });
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [tab, setTab] = useState<Tab>("waiting");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [acceptOrder, setAcceptOrder] = useState<Order | null>(null);
  const [appointmentAt, setAppointmentAt] = useState("");
  const [assignedTech, setAssignedTech] = useState("SELF");
  const [rejectOrder, setRejectOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reportOrder, setReportOrder] = useState<Order | null>(null);
  const [report, setReport] = useState<Report>(EMPTY_REPORT);
  const [reportError, setReportError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersResponse, teamResponse] = await Promise.all([
        fetch("/api/agent-portal/orders", { cache: "no-store" }),
        fetch("/api/dealer/team", { cache: "no-store" }),
      ]);
      const result = await ordersResponse.json();
      const team = await teamResponse.json();
      if (!ordersResponse.ok || !result.success) throw new Error(result.message || "Không tải được lệnh");
      setDealer(result.dealer);
      setOrders(result.data || []);
      setSummary(result.summary || { revenue: 0, paid: 0, pending: 0 });
      if (teamResponse.ok && team.success) setTechnicians((team.data || []).filter((item: Technician) => item.active));
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được dữ liệu" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => ({
    waiting: orders.filter((item) => item.status === "ASSIGNED"),
    doing: orders.filter((item) => ["ACCEPTED", "IN_PROGRESS"].includes(item.status)),
    recent: orders.filter((item) => ["COMPLETED", "CANCELLED"].includes(item.status)).slice(0, 30),
  }), [orders]);

  async function request(url: string, body?: Record<string, unknown>) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(url, { method: body ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || { status: "IN_PROGRESS" }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được lệnh");
      setNotice({ kind: "success", text: result.message || "Đã cập nhật." });
      await load();
      return true;
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được lệnh" });
      return false;
    } finally { setBusy(false); }
  }

  async function confirmAccept() {
    if (!acceptOrder || !appointmentAt) { setNotice({ kind: "error", text: "Hãy chọn giờ hẹn đến nhà khách." }); return; }
    const ok = await request(`/api/agent-portal/orders/${acceptOrder.id}/accept`, { appointmentAt, technicianId: assignedTech === "SELF" ? null : assignedTech });
    if (ok) { setAcceptOrder(null); setAppointmentAt(""); setAssignedTech("SELF"); setTab("doing"); }
  }

  async function confirmReject() {
    if (!rejectOrder || rejectReason.trim().length < 3) { setNotice({ kind: "error", text: "Hãy ghi rõ lý do không nhận được lệnh." }); return; }
    const ok = await request(`/api/agent-portal/orders/${rejectOrder.id}/reject`, { reason: rejectReason.trim() });
    if (ok) { setRejectOrder(null); setRejectReason(""); }
  }

  async function upload(file: File, field: "oldCorePhoto" | "newCorePhoto" | "finalPhoto") {
    setBusy(true);
    try {
      const data = new FormData(); data.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Tải ảnh thất bại");
      setReport((current) => ({ ...current, [field]: result.url }));
      setReportError("");
    } catch (error) { setReportError(error instanceof Error ? error.message : "Tải ảnh thất bại"); }
    finally { setBusy(false); }
  }

  async function submitReport() {
    if (!reportOrder || busy) return;
    const needsCore = isCoreService(reportOrder.serviceType);
    if (!report.workDone.trim()) return setReportError("Hãy ghi công việc đã làm.");
    if (!report.finalPhoto) return setReportError("Thiếu ảnh máy sau khi hoàn thành.");
    if (needsCore && (!report.oldCorePhoto || !report.newCorePhoto)) return setReportError("Thay lõi bắt buộc có ảnh lõi cũ và lõi mới.");
    if (report.tdsBefore === "" || report.tdsAfter === "") return setReportError("Hãy nhập TDS trước và sau khi làm.");
    if (!report.customerConfirmationName.trim()) return setReportError("Hãy nhập tên khách hàng xác nhận.");
    if (!report.signatureImage) return setReportError("Khách hàng cần ký trực tiếp hoặc chụp/chọn ảnh chữ ký trước khi gửi.");
    setBusy(true); setReportError("");
    try {
      const response = await fetch(`/api/service-orders/${reportOrder.id}/report`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không gửi được báo cáo");
      setReportOrder(null); setReport(EMPTY_REPORT); setNotice({ kind: "success", text: result.message }); setTab("recent"); await load();
    } catch (error) { setReportError(error instanceof Error ? error.message : "Không gửi được báo cáo"); }
    finally { setBusy(false); }
  }

  const visible = groups[tab];
  return <main className="min-h-screen bg-slate-100">
    <PortalHeader title="Đại lý dịch vụ" subtitle={dealer ? `${dealer.dealerCode} · ${dealer.name}` : "Đang tải hồ sơ"} homeHref="/agent-portal" homeLabel="Lệnh của tôi" onLogout={() => fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"))}>
      <Link href="/scan" className="btn-secondary"><Icon name="qr" size={16}/>Kích hoạt máy</Link>
      <Link href="/agent-portal/team" className="btn-secondary"><Icon name="users" size={16}/>Kỹ thuật viên</Link>
      <Link href="/agent-portal/profile" className="btn-secondary"><Icon name="store" size={16}/>Hồ sơ</Link>
      <Link href="/agent-portal/payments" className="btn-secondary"><Icon name="wallet" size={16}/>Công dịch vụ</Link>
    </PortalHeader>

    <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-6">
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Chờ nhận" value={groups.waiting.length} icon="bell" tone="amber" />
        <MetricCard label="Đang làm" value={groups.doing.length} icon="wrench" tone="blue" />
        <MetricCard label="Hoàn thành" value={groups.recent.filter((item) => item.status === "COMPLETED").length} icon="check" tone="emerald" />
        <MetricCard label="Tiền công" value={money(summary.revenue)} icon="wallet" tone="violet" />
      </section>

      <nav className="grid grid-cols-3 rounded-2xl bg-white p-1 shadow-sm">
        {([["waiting", `Chờ nhận (${groups.waiting.length})`], ["doing", `Đang làm (${groups.doing.length})`], ["recent", "Gần đây"]] as [Tab, string][]).map(([key, label]) =>
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-xl px-2 py-3 text-sm font-black ${tab === key ? "bg-emerald-600 text-white" : "text-slate-600"}`}>{label}</button>)}
      </nav>

      {loading ? <div className="surface-card p-10 text-center text-slate-500">Đang tải lệnh...</div> : <section className="space-y-3">
        {visible.map((order) => <article key={order.id} className="surface-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">{order.orderCode}</p><h2 className="mt-1 text-lg font-black">{order.serviceType}</h2></div><StatusBadge value={order.status}/></div>

          {tab === "waiting" ? <div className="mt-4 grid gap-2 rounded-2xl bg-amber-50 p-4 text-sm">
            <p><strong>Khu vực:</strong> {order.area || "Chưa xác định"}</p>
            <p><strong>Khoảng cách:</strong> {order.distanceKm == null ? "Chưa có GPS để tính" : `${order.distanceKm} km`}</p>
            <p className="text-slate-500">Tên, số điện thoại và địa chỉ chi tiết sẽ hiện sau khi nhận lệnh.</p>
          </div> : <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
            <p className="font-black text-slate-900">{order.customerName}</p>
            {order.customerPhone && <a href={`tel:${order.customerPhone}`} className="block font-bold text-emerald-700">{order.customerPhone}</a>}
            {order.address && <p>{order.address}</p>}
            <p><strong>Giờ hẹn:</strong> {dateTime(order.dueDate)}</p>
            {order.technician && <p><strong>KTV:</strong> {order.technician.name} · {order.technician.phone}</p>}
          </div>}

          <div className="mt-4 grid gap-2 sm:flex">
            {order.status === "ASSIGNED" && <>
              <button type="button" onClick={() => { setAcceptOrder(order); setAppointmentAt(""); setAssignedTech("SELF"); }} className="btn-primary flex-1 p-3 font-black text-white">Nhận lệnh</button>
              <button type="button" onClick={() => { setRejectOrder(order); setRejectReason(""); }} className="rounded-xl bg-rose-600 px-4 py-3 font-black text-white">Không nhận được lệnh này?</button>
            </>}
            {order.status === "ACCEPTED" && !order.technician && <button type="button" disabled={busy} onClick={() => void request(`/api/service-orders/${order.id}`, undefined)} className="btn-primary flex-1 p-3 font-black text-white">Bắt đầu làm</button>}
            {order.status === "IN_PROGRESS" && !order.technician && <button type="button" onClick={() => { setReportOrder(order); setReport(EMPTY_REPORT); setReportError(""); }} className="w-full rounded-xl bg-slate-900 p-3 font-black text-white">Báo cáo hoàn thành</button>}
          </div>
        </article>)}
        {!visible.length && <div className="surface-card p-12 text-center text-slate-500"><Icon name="check" size={34} className="mx-auto mb-2"/><p className="font-bold">Không có lệnh trong mục này.</p></div>}
      </section>}
    </div>

    {acceptOrder && <Modal title="Nhận lệnh" onClose={() => setAcceptOrder(null)}><div className="space-y-4">
      <div className="rounded-xl bg-emerald-50 p-3 text-sm"><strong>{acceptOrder.serviceType}</strong><br/>{acceptOrder.area} {acceptOrder.distanceKm != null ? `· ${acceptOrder.distanceKm} km` : ""}</div>
      <label className="block"><span className="field-label">Giờ hẹn đến nhà khách *</span><input type="datetime-local" value={appointmentAt} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)} onChange={(e) => setAppointmentAt(e.target.value)} required className="w-full"/></label>
      <label className="block"><span className="field-label">Người thực hiện *</span><select value={assignedTech} onChange={(e) => setAssignedTech(e.target.value)} className="w-full"><option value="SELF">Tôi tự làm</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name} · {tech.phone}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => void confirmAccept()} className="btn-primary w-full p-3 font-black text-white disabled:opacity-50">{busy ? "Đang nhận..." : "Nhận lệnh"}</button>
    </div></Modal>}

    {rejectOrder && <Modal title="Từ chối lệnh" onClose={() => setRejectOrder(null)}><div className="space-y-4"><p className="text-sm text-slate-600">Ghi rõ lý do để CSKH có thể điều phối lại đúng nơi.</p><textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} placeholder="Ví dụ: Hôm nay không đủ nhân sự / ngoài phạm vi phục vụ..." className="w-full"/><button type="button" disabled={busy} onClick={() => void confirmReject()} className="w-full rounded-xl bg-rose-600 p-3 font-black text-white">Từ chối lệnh</button></div></Modal>}

    {reportOrder && <Modal title={`Báo cáo ${reportOrder.orderCode}`} onClose={() => { setReportOrder(null); setReport(EMPTY_REPORT); setReportError(""); }} wide><div className="space-y-4">
      <label className="block"><span className="field-label">Công việc đã làm *</span><textarea rows={3} value={report.workDone} onChange={(e) => setReport({ ...report, workDone: e.target.value })} className="w-full"/></label>
      <label className="block"><span className="field-label">Vật tư đã thay</span><input value={report.products} onChange={(e) => setReport({ ...report, products: e.target.value })} placeholder="Tên vật tư, số lượng" className="w-full"/></label>
      {isCoreService(reportOrder.serviceType) && <><Photo label="Ảnh lõi cũ *" value={report.oldCorePhoto} onFile={(f) => void upload(f, "oldCorePhoto")}/><Photo label="Ảnh lõi mới *" value={report.newCorePhoto} onFile={(f) => void upload(f, "newCorePhoto")}/></>}
      <Photo label="Ảnh máy sau khi làm xong *" value={report.finalPhoto} onFile={(f) => void upload(f, "finalPhoto")}/>
      <div className="grid grid-cols-2 gap-3"><label><span className="field-label">TDS trước *</span><input type="number" min="0" inputMode="decimal" value={report.tdsBefore} onChange={(e) => setReport({ ...report, tdsBefore: e.target.value })}/></label><label><span className="field-label">TDS sau *</span><input type="number" min="0" inputMode="decimal" value={report.tdsAfter} onChange={(e) => setReport({ ...report, tdsAfter: e.target.value })}/></label></div>
      <ServiceSignatureCapture customerName={report.customerConfirmationName} signatureImage={report.signatureImage} onCustomerNameChange={(value)=>setReport((current)=>({...current,customerConfirmationName:value}))} onSignatureImageChange={(value)=>setReport((current)=>({...current,signatureImage:value}))} disabled={busy}/>
      {reportError && <div className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{reportError}</div>}
      <button type="button" disabled={busy} onClick={() => void submitReport()} className="btn-primary w-full p-3 font-black text-white disabled:opacity-50">{busy ? "Đang gửi..." : "Gửi báo cáo hoàn thành"}</button>
    </div></Modal>}
  </main>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3"><div className={`max-h-[94vh] w-full overflow-y-auto rounded-3xl bg-white p-5 ${wide ? "max-w-2xl" : "max-w-md"}`}><div className="mb-5 flex items-center justify-between"><h3 className="text-xl font-black">{title}</h3><button type="button" onClick={onClose} className="icon-button"><Icon name="x" size={18}/></button></div>{children}</div></div>;
}
function Photo({ label, value, onFile }: { label: string; value: string; onFile: (file: File) => void }) {
  return <label className="block"><span className="field-label">{label}</span><input type="file" accept="image/*" capture="environment" onChange={(e: ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) onFile(file); }}/>{value && <a href={value} target="_blank" rel="noreferrer" className="mt-1 block text-sm font-bold text-emerald-700">Xem ảnh đã chọn</a>}</label>;
}
