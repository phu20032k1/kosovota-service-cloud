"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { readApiResponse } from "@/lib/client-api";

type Report = {
  id: string;
  serviceType: string;
  products?: string | null;
  note?: string | null;
  oldCorePhoto?: string | null;
  newCorePhoto?: string | null;
  finalPhoto?: string | null;
  signature?: string | null;
  createdAt: string;
};

type Order = {
  id: string;
  orderCode: string;
  status: string;
  serviceType: string;
  customerName: string;
  customerPhone: string;
  address?: string | null;
  dueDate?: string | null;
  serviceFee?: number | null;
  paymentStatus: string;
  rejectReason?: string | null;
  createdAt: string;
  updatedAt: string;
  dealer?: { id: string; dealerCode: string; name: string; phone: string; services?: string | null } | null;
  technician?: { id: string; name: string; phone: string } | null;
  machine: {
    id: string;
    model: string;
    name?: string | null;
    serial?: string | null;
    status: string;
    installDate?: string | null;
    warrantyMonths?: number | null;
    customer?: { id: string; name: string; phone: string; email?: string | null; address?: string | null } | null;
    activations?: Array<{ id: string; step: number; installerName?: string | null; installerPhone?: string | null; dealerCode?: string | null; createdAt: string }>;
    maintenanceSchedules?: Array<{ id: string; title: string; dueDate: string; status: string }>;
  };
  reports: Report[];
  maintenanceSchedule?: { id: string; title: string; dueDate: string; status: string } | null;
  sourceTicket?: {
    id: string;
    ticketCode: string;
    type: string;
    priority: string;
    status: string;
    subject: string;
    description?: string | null;
    contactName: string;
    contactPhone: string;
    createdAt: string;
    messages?: Array<{ id: string; authorName: string; message: string; createdAt: string }>;
  } | null;
};

const ORDER_STATUSES = [
  ["NEW", "Mới/chờ điều phối"],
  ["CALLED_NO_ANSWER", "Đã gọi - chưa nghe máy"],
  ["CUSTOMER_ACCEPTED", "Khách đồng ý"],
  ["CUSTOMER_SELF_SERVICE", "Khách tự thực hiện"],
  ["CUSTOMER_REJECTED", "Khách từ chối"],
  ["RESCHEDULED", "Hẹn lại"],
  ["COMPLAINT", "Khiếu nại"],
  ["ASSIGNED", "Đã giao đại lý"],
  ["ACCEPTED", "Đại lý đã nhận"],
  ["IN_PROGRESS", "Đang thực hiện"],
  ["COMPLETED", "Hoàn thành"],
  ["CANCELLED", "Đã hủy"],
] as const;

function formatDate(value?: string | null, includeTime = true) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(new Date(value));
}

function money(value?: number | null) {
  return typeof value === "number" ? `${new Intl.NumberFormat("vi-VN").format(value)} đ` : "Chưa nhập";
}

export default function ServiceOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [status, setStatus] = useState("NEW");
  const [dueDate, setDueDate] = useState("");
  const [serviceFee, setServiceFee] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/service-orders/${id}`, { cache: "no-store" });
      const result = await readApiResponse<Order>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không tải được lệnh dịch vụ.");
      const item = result.data;
      setOrder(item);
      setStatus(item.status);
      setDueDate(item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 16) : "");
      setServiceFee(item.serviceFee == null ? "" : String(item.serviceFee));
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được lệnh dịch vụ." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const activeSchedules = useMemo(() => (order?.machine.maintenanceSchedules || [])
    .filter((item) => !["COMPLETED", "DISABLED", "SELF_SERVICE"].includes(item.status))
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate)), [order]);

  async function save() {
    if (!order) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/service-orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          dueDate: dueDate || null,
          serviceFee: serviceFee === "" ? null : Number(serviceFee),
        }),
      });
      const result = await readApiResponse<Order>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được lệnh.");
      setNotice({ kind: "success", text: "Đã lưu trạng thái, lịch hẹn và phí dịch vụ." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được lệnh." });
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-slate-50/70">
    <OperationsHeader
      title={order ? `Chi tiết lệnh ${order.orderCode}` : "Chi tiết lệnh dịch vụ"}
      subtitle="Xem lại đầy đủ thông tin từ Ticket, khách hàng, máy, điều phối và báo cáo hiện trường"
      actions={<button type="button" onClick={load} className="icon-button" title="Tải lại"><Icon name="refresh" size={18}/></button>}
    />
    <div className="page-container space-y-5">
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      {loading ? <LoadingState label="Đang tải chi tiết lệnh..."/> : !order ? <Notice kind="error">Không tìm thấy lệnh dịch vụ.</Notice> : <>
        <section className="surface-card overflow-hidden">
          <div className="order-detail-hero">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge value={order.status}/><StatusBadge value={order.paymentStatus}/>{order.sourceTicket && <span className="mini-chip"><Icon name="alert" size={14}/> Từ Ticket {order.sourceTicket.ticketCode}</span>}</div>
              <h2 className="mt-4 break-words text-2xl font-black tracking-[-.035em] text-slate-950 sm:text-3xl">{order.serviceType}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Tạo {formatDate(order.createdAt)} · Cập nhật {formatDate(order.updatedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/operations-map?order=${order.id}`} className="btn-primary px-4 py-3 text-sm font-black text-white"><Icon name="map" size={17}/> Mở Điều phối</Link>
              <Link href={`/machine/${order.machine.id}`} className="btn-secondary px-4 py-3 text-sm font-black"><Icon name="droplet" size={17}/> Hồ sơ máy</Link>
              {order.sourceTicket && <Link href={`/admin/tickets?ticket=${order.sourceTicket.id}`} className="btn-secondary px-4 py-3 text-sm font-black"><Icon name="alert" size={17}/> Ticket nguồn</Link>}
            </div>
          </div>
          <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryStat label="Trạng thái" value={ORDER_STATUSES.find(([key]) => key === order.status)?.[1] || order.status} icon="activity"/>
            <SummaryStat label="Hạn xử lý" value={formatDate(order.dueDate)} icon="calendar"/>
            <SummaryStat label="Đại lý phụ trách" value={order.dealer ? `${order.dealer.dealerCode} · ${order.dealer.name}` : "Chưa phân công"} icon="store"/>
            <SummaryStat label="Báo cáo hiện trường" value={`${order.reports.length} báo cáo`} icon="file"/>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
          <div className="space-y-5 min-w-0">
            {order.sourceTicket && <section className="surface-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="section-kicker">Mô tả lại yêu cầu</p><h3 className="mt-1 text-xl font-black text-slate-950">{order.sourceTicket.subject}</h3></div><div className="flex gap-2"><StatusBadge value={order.sourceTicket.priority}/><StatusBadge value={order.sourceTicket.status}/></div></div>
              <div className="requirement-summary mt-5"><span className="summary-icon"><Icon name="file" size={20}/></span><div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Nội dung khách hàng/đại lý đã yêu cầu</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{order.sourceTicket.description || "Ticket chưa có mô tả chi tiết. CSKH cần bổ sung trước khi triển khai."}</p></div></div>
              <div className="summary-grid mt-4"><Detail label="Loại yêu cầu" value={order.sourceTicket.type}/><Detail label="Người liên hệ" value={order.sourceTicket.contactName}/><Detail label="Điện thoại" value={order.sourceTicket.contactPhone}/><Detail label="Ngày tiếp nhận" value={formatDate(order.sourceTicket.createdAt)}/></div>
              {!!order.sourceTicket.messages?.length && <div className="mt-5"><p className="text-sm font-black text-slate-900">Trao đổi trong Ticket</p><div className="mt-3 space-y-2">{order.sourceTicket.messages.map((message) => <article key={message.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2 text-xs"><strong className="text-slate-700">{message.authorName}</strong><span className="text-slate-400">{formatDate(message.createdAt)}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{message.message}</p></article>)}</div></div>}
            </section>}

            <section className="surface-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="section-kicker">Khách hàng & thiết bị</p><h3 className="mt-1 text-xl font-black">Thông tin thực hiện dịch vụ</h3></div><Link href={order.machine.customer ? `/admin/customers/${order.machine.customer.id}` : `/machine/${order.machine.id}`} className="btn-secondary px-3 py-2 text-sm font-bold">Xem hồ sơ 360° <Icon name="chevron-right" size={16}/></Link></div>
              <div className="summary-grid mt-5"><Detail label="Tên khách hàng" value={order.machine.customer?.name || order.customerName}/><Detail label="Số điện thoại" value={order.machine.customer?.phone || order.customerPhone}/><Detail label="Địa chỉ" value={order.machine.customer?.address || order.address || "Chưa cập nhật"}/><Detail label="Email" value={order.machine.customer?.email || "Chưa cập nhật"}/></div>
              <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.15em] text-emerald-700">Máy đang xử lý</p><h4 className="mt-2 text-xl font-black text-slate-950">{order.machine.name || order.machine.model}</h4><p className="mt-1 text-sm text-slate-600">ID: {order.machine.id}{order.machine.serial ? ` · Seri: ${order.machine.serial}` : ""}</p></div><StatusBadge value={order.machine.status}/></div><div className="summary-grid mt-4"><Detail label="Model" value={order.machine.model}/><Detail label="Ngày lắp" value={formatDate(order.machine.installDate, false)}/><Detail label="Bảo hành" value={order.machine.warrantyMonths ? `${order.machine.warrantyMonths} tháng` : "Chưa cập nhật"}/><Detail label="Lịch bảo trì mở" value={`${activeSchedules.length} lịch`}/></div></div>
            </section>

            <section className="surface-card p-5 sm:p-6"><div><p className="section-kicker">Báo cáo dịch vụ</p><h3 className="mt-1 text-xl font-black">Kết quả đã thực hiện tại nhà khách</h3></div>{order.reports.length ? <div className="mt-5 space-y-4">{order.reports.slice().sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt)).map((report, index) => <article key={report.id} className="report-detail-card"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.15em] text-violet-700">Báo cáo #{order.reports.length-index}</p><h4 className="mt-1 font-black text-slate-950">{report.serviceType}</h4></div><span className="text-xs font-semibold text-slate-400">{formatDate(report.createdAt)}</span></div><div className="summary-grid mt-4"><Detail label="Vật tư/sản phẩm" value={report.products || "Không ghi nhận"}/><Detail label="Ghi chú" value={report.note || "Không có"}/><Detail label="Ảnh trước/sau" value={`${[report.oldCorePhoto, report.newCorePhoto, report.finalPhoto].filter(Boolean).length} ảnh`}/><Detail label="Chữ ký khách hàng" value={report.signature ? "Đã ký" : "Chưa có"}/></div>{[report.oldCorePhoto, report.newCorePhoto, report.finalPhoto].some(Boolean) && <div className="mt-4 flex flex-wrap gap-2">{report.oldCorePhoto && <a className="mini-chip" href={report.oldCorePhoto} target="_blank" rel="noreferrer"><Icon name="camera" size={14}/> Ảnh trước</a>}{report.newCorePhoto && <a className="mini-chip" href={report.newCorePhoto} target="_blank" rel="noreferrer"><Icon name="camera" size={14}/> Ảnh thay mới</a>}{report.finalPhoto && <a className="mini-chip" href={report.finalPhoto} target="_blank" rel="noreferrer"><Icon name="camera" size={14}/> Ảnh hoàn tất</a>}</div>}</article>)}</div> : <div className="empty-detail-state mt-5"><Icon name="file" size={28}/><strong>Chưa có báo cáo hiện trường</strong><p>Khi đại lý/KTV gửi báo cáo, toàn bộ ảnh, vật tư, chữ ký và ghi chú sẽ xuất hiện tại đây.</p></div>}</section>
          </div>

          <aside className="space-y-5 min-w-0">
            <section className="surface-card p-5"><p className="section-kicker">Cập nhật nhanh</p><h3 className="mt-1 text-lg font-black">Điều hành lệnh</h3><div className="mt-5 space-y-4"><label className="block"><span className="field-label">Trạng thái</span><select value={status} onChange={(event)=>setStatus(event.target.value)}>{ORDER_STATUSES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="block"><span className="field-label">Hạn xử lý/lịch hẹn</span><input type="datetime-local" value={dueDate} onChange={(event)=>setDueDate(event.target.value)}/></label><label className="block"><span className="field-label">Phí dịch vụ (đ)</span><input type="number" min="0" value={serviceFee} onChange={(event)=>setServiceFee(event.target.value)} placeholder="0"/></label><button type="button" onClick={save} disabled={busy} className="btn-primary w-full justify-center px-4 py-3 font-black text-white disabled:opacity-60"><Icon name="check" size={17}/>{busy ? "Đang lưu..." : "Lưu thay đổi"}</button></div></section>

            <section className="surface-card p-5"><p className="section-kicker">Phân công</p><div className="mt-4 space-y-3"><InfoCard icon="store" label="Đại lý/CTV" title={order.dealer ? `${order.dealer.dealerCode} · ${order.dealer.name}` : "Chưa phân công"} detail={order.dealer?.phone || "Mở Điều phối để chọn đại lý phù hợp"}/><InfoCard icon="wrench" label="Kỹ thuật viên" title={order.technician?.name || "Chưa giao KTV"} detail={order.technician?.phone || "Đại lý sẽ phân công sau khi nhận lệnh"}/><InfoCard icon="wallet" label="Thanh toán" title={money(order.serviceFee)} detail={`Trạng thái: ${order.paymentStatus}`}/></div></section>

            <section className="surface-card p-5"><p className="section-kicker">Lịch sử vận hành</p><div className="timeline mt-4"><TimelineItem title="Tạo lệnh dịch vụ" time={formatDate(order.createdAt)} active/><TimelineItem title={order.dealer ? `Giao ${order.dealer.name}` : "Đang chờ phân công đại lý"} time={order.dealer ? formatDate(order.updatedAt) : "Chưa thực hiện"} active={Boolean(order.dealer)}/><TimelineItem title="Thực hiện tại khách hàng" time={order.status === "IN_PROGRESS" || order.status === "COMPLETED" ? formatDate(order.updatedAt) : "Chưa thực hiện"} active={["IN_PROGRESS","COMPLETED"].includes(order.status)}/><TimelineItem title="Hoàn thành & có báo cáo" time={order.status === "COMPLETED" ? formatDate(order.updatedAt) : "Chưa hoàn thành"} active={order.status === "COMPLETED"}/></div></section>
          </aside>
        </section>
      </>}
    </div>
  </main>;
}

function SummaryStat({ label, value, icon }: { label: string; value: string; icon: "activity" | "calendar" | "store" | "file" }) {
  return <div className="bg-white p-4 sm:p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon name={icon} size={18}/></span><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[.13em] text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-black text-slate-900">{value}</p></div></div></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold leading-6 text-slate-800">{value}</p></div>;
}

function InfoCard({ icon, label, title, detail }: { icon: "store" | "wrench" | "wallet"; label: string; title: string; detail: string }) {
  return <div className="flex min-w-0 gap-3 rounded-2xl border border-slate-200 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon name={icon} size={18}/></span><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.13em] text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-black text-slate-900">{title}</p><p className="mt-1 break-words text-xs leading-5 text-slate-500">{detail}</p></div></div>;
}

function TimelineItem({ title, time, active }: { title: string; time: string; active: boolean }) {
  return <div className={`timeline-item ${active ? "is-active" : ""}`}><span className="timeline-dot"/><div><p className="text-sm font-black text-slate-800">{title}</p><p className="mt-1 text-xs text-slate-500">{time}</p></div></div>;
}
