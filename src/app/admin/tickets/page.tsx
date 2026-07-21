"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { readApiResponse } from "@/lib/client-api";

type TicketMessage = { id: string; authorName: string; message: string; isInternal: boolean; createdAt: string };
type ServiceOrder = {
  id: string;
  orderCode: string;
  machineId: string;
  serviceType: string;
  status: string;
  dueDate?: string | null;
  createdAt: string;
  dealer?: { id: string; dealerCode: string; name: string } | null;
  technician?: { id: string; name: string; phone: string } | null;
  reports: { id: string; createdAt: string }[];
};
type Ticket = {
  id: string;
  ticketCode: string;
  type: string;
  source: string;
  subject: string;
  description?: string | null;
  status: string;
  priority: string;
  contactName: string;
  contactPhone: string;
  dueAt?: string | null;
  createdAt: string;
  customer?: { id: string; name: string; phone: string; address?: string | null } | null;
  machine?: { id: string; model: string; name?: string | null; status?: string } | null;
  dealer?: { id: string; dealerCode: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
  serviceOrder?: ServiceOrder | null;
  messages: TicketMessage[];
};
type Option = { id: string; name: string; phone?: string; address?: string | null };
type Data = {
  tickets: Ticket[];
  customers: Option[];
  machines: { id: string; model: string; name?: string | null; customer?: Option | null }[];
  dealers: { id: string; dealerCode: string; name: string }[];
  staff: { id: string; name: string }[];
};

type TicketForm = {
  type: string;
  subject: string;
  description: string;
  priority: string;
  customerId: string;
  machineId: string;
  dealerId: string;
  assigneeId: string;
  contactName: string;
  contactPhone: string;
  dueAt: string;
};

const EMPTY_FORM: TicketForm = {
  type: "WARRANTY",
  subject: "",
  description: "",
  priority: "NORMAL",
  customerId: "",
  machineId: "",
  dealerId: "",
  assigneeId: "",
  contactName: "",
  contactPhone: "",
  dueAt: "",
};
const OPERATIONAL_TYPES = new Set(["WARRANTY", "REPAIR", "MAINTENANCE", "INSTALLATION", "COMPLAINT"]);
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const TYPE_LABEL: Record<string, string> = { WARRANTY: "Bảo hành", COMPLAINT: "Khiếu nại", REPAIR: "Sửa chữa", MAINTENANCE: "Bảo trì", INSTALLATION: "Lắp đặt", CONSULTING: "Tư vấn" };
const STATUS_FILTER_LABEL: Record<string, string> = { ALL: "Tất cả", NEW: "Mới", ASSIGNED: "Đã giao", IN_PROGRESS: "Đang xử lý", WAITING_CUSTOMER: "Chờ khách hàng", RESOLVED: "Đã xử lý", CLOSED: "Đã đóng", CANCELLED: "Đã hủy" };

export default function TicketsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<TicketForm>(EMPTY_FORM);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/support-tickets", { cache: "no-store" });
      const result = await readApiResponse<Data>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không tải được phiếu hỗ trợ");
      const nextData = result.data;
      setData(nextData);
      const requestedTicketId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ticket") : null;
      setSelectedId((current) => {
        if (requestedTicketId && nextData.tickets.some((ticket: Ticket) => ticket.id === requestedTicketId)) return requestedTicketId;
        return current && nextData.tickets.some((ticket: Ticket) => ticket.id === current) ? current : nextData.tickets[0]?.id || null;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được phiếu hỗ trợ");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const selected = data?.tickets.find((ticket) => ticket.id === selectedId) || null;
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.tickets || []).filter((ticket) => {
      const matchesStatus = filter === "ALL" || ticket.status === filter;
      const text = `${ticket.ticketCode} ${ticket.subject} ${ticket.contactName} ${ticket.contactPhone} ${ticket.machine?.id || ""} ${ticket.serviceOrder?.orderCode || ""}`.toLowerCase();
      return matchesStatus && (!normalized || text.includes(normalized));
    });
  }, [data, filter, query]);
  const stats = useMemo(() => ({
    open: data?.tickets.filter((ticket) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.status)).length || 0,
    critical: data?.tickets.filter((ticket) => ticket.priority === "CRITICAL" && !["RESOLVED", "CLOSED"].includes(ticket.status)).length || 0,
    waiting: data?.tickets.filter((ticket) => ticket.status === "WAITING_CUSTOMER").length || 0,
    dispatched: data?.tickets.filter((ticket) => Boolean(ticket.serviceOrder)).length || 0,
  }), [data]);
  const customerMachines = useMemo(() => form.customerId
    ? (data?.machines || []).filter((machine) => machine.customer?.id === form.customerId)
    : data?.machines || [], [data, form.customerId]);

  function showNotice(kind: "success" | "error", text: string) {
    if (kind === "success") { setMessage(text); setError(""); }
    else { setError(text); setMessage(""); }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setCreatedOrderId(null);
    try {
      const response = await fetch("/api/support-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await readApiResponse<Ticket>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không tạo được phiếu hỗ trợ");
      showNotice("success", result.message || "Đã tạo yêu cầu hỗ trợ.");
      setCreatedOrderId(result.data.serviceOrder?.id || null);
      setOpen(false);
      setForm(EMPTY_FORM);
      await load();
      setSelectedId(result.data.id);
    } catch (caught) {
      showNotice("error", caught instanceof Error ? caught.message : "Không tạo được phiếu hỗ trợ");
    } finally {
      setBusy(false);
    }
  }

  async function update(payload: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/support-tickets/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await readApiResponse<Ticket>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được phiếu hỗ trợ");
      showNotice("success", result.message || "Đã cập nhật yêu cầu.");
      setReply("");
      await load();
    } catch (caught) {
      showNotice("error", caught instanceof Error ? caught.message : "Không cập nhật được phiếu hỗ trợ");
    } finally {
      setBusy(false);
    }
  }

  function selectCustomer(id: string) {
    const customer = data?.customers.find((item) => item.id === id);
    const machines = (data?.machines || []).filter((machine) => machine.customer?.id === id);
    setForm((current) => ({
      ...current,
      customerId: id,
      machineId: machines.length === 1 ? machines[0].id : "",
      contactName: customer?.name || current.contactName,
      contactPhone: customer?.phone || current.contactPhone,
    }));
  }

  return <main className="min-h-screen">
    <OperationsHeader title="Phiếu hỗ trợ & Điều phối" subtitle="Tạo yêu cầu, tự sinh lệnh điều phối, phân công và theo dõi SLA trên một luồng" actions={<button type="button" onClick={load} className="icon-button"><Icon name="refresh" size={18}/></button>}/>
    <div className="page-container space-y-4">
      {message && <Notice kind="success"><div className="flex flex-wrap items-center gap-3"><span>{message}</span>{createdOrderId && <Link href={`/operations-map?order=${createdOrderId}`} className="mini-chip mini-chip--green"><Icon name="map" size={14}/>Mở lệnh vừa tạo tại Điều phối</Link>}</div></Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data ? <LoadingState label="Đang tải yêu cầu hỗ trợ..."/> : data && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Đang mở" value={stats.open} icon="alert" tone="blue"/>
          <MetricCard label="Khẩn cấp" value={stats.critical} icon="bell" tone="rose"/>
          <MetricCard label="Chờ khách hàng" value={stats.waiting} icon="clock" tone="amber"/>
          <MetricCard label="Đã sang Điều phối" value={stats.dispatched} icon="map" tone="emerald"/>
        </section>

        <section className="surface-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Tổng quan nhanh</p>
            <p className="mt-1 text-sm text-slate-600">Theo dõi phiếu hỗ trợ, lệnh điều phối và lịch sử trao đổi trong cùng một màn hình.</p>
          </div>
          <span className="mini-chip mini-chip--green"><Icon name="file" size={14}/>{visible.length} phiếu đang hiển thị</span>
        </section>

        <section className="surface-card p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
            <label className="relative"><Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã phiếu, lệnh, khách hàng hoặc máy..." className="pl-11"/></label>
            <button type="button" onClick={() => setOpen(true)} className="btn-primary justify-center px-5 py-3 font-black text-white"><Icon name="plus" size={17}/>Tạo yêu cầu</button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {["ALL", "NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"].map((status) => <button type="button" key={status} onClick={() => setFilter(status)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${filter === status ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{STATUS_FILTER_LABEL[status] || status}</button>)}
          </div>
        </section>

        <section className="ticket-workspace">
          <article className="surface-card overflow-hidden">
            <div className="border-b px-5 py-4"><h2 className="page-section-title">Danh sách yêu cầu</h2><p className="page-section-subtitle">Bấm từng yêu cầu để xem đầy đủ dữ liệu và lệnh Điều phối liên kết.</p></div>
            <div className="ticket-list-scroll divide-y">
              {visible.map((ticket) => <button type="button" key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`ticket-list-item ${selected?.id === ticket.id ? "is-selected" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black">{ticket.ticketCode} · {ticket.subject}</p>
                    <p className="mt-1 text-sm text-slate-600">{ticket.contactName} · {ticket.contactPhone}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      {ticket.machine && <span className="mini-chip"><Icon name="droplet" size={13}/>{ticket.machine.id}</span>}
                      {ticket.serviceOrder && <span className="mini-chip mini-chip--green"><Icon name="map" size={13}/>{ticket.serviceOrder.orderCode}</span>}
                      {!ticket.serviceOrder && ticket.machine && <span className="mini-chip mini-chip--amber">Chưa tạo lệnh</span>}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">Tạo {date(ticket.createdAt)} · Hạn {date(ticket.dueAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2"><StatusBadge value={ticket.priority}/><StatusBadge value={ticket.status}/></div>
                </div>
              </button>)}
              {!visible.length && <div className="empty-state"><div><Icon name="file" size={32} className="mx-auto mb-2"/><p className="font-bold">Không có yêu cầu phù hợp</p></div></div>}
            </div>
          </article>

          <aside className="surface-card ticket-detail-panel">
            {selected ? <TicketDetail ticket={selected} data={data} reply={reply} setReply={setReply} busy={busy} update={update}/> : <div className="empty-state"><div><Icon name="chevron-right" size={30} className="mx-auto mb-2"/><p className="font-bold">Chọn một yêu cầu để xử lý</p></div></div>}
          </aside>
        </section>
      </>}
    </div>

    {open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <form onSubmit={create} className="modal-panel max-w-4xl">
        <div className="modal-header"><div><p className="eyebrow">Phiếu hỗ trợ → Điều phối</p><h3 className="mt-1 text-2xl font-black">Tạo yêu cầu hỗ trợ</h3><p className="text-sm text-slate-500">Khi chọn máy, hệ thống tự tạo lệnh và đưa sang tab Điều phối.</p></div><button type="button" onClick={() => setOpen(false)} className="icon-button"><Icon name="x" size={18}/></button></div>
        <div className="modal-body space-y-5">
          <div className="form-grid">
            <Field label="Loại yêu cầu" className="span-4"><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Mức ưu tiên" className="span-4"><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="LOW">Thấp</option><option value="NORMAL">Bình thường</option><option value="HIGH">Cao</option><option value="CRITICAL">Khẩn cấp</option></select></Field>
            <Field label="Hạn xử lý" className="span-4"><input type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })}/></Field>
            <Field label="Khách hàng CRM" className="span-6"><select value={form.customerId} onChange={(event) => selectCustomer(event.target.value)}><option value="">Nhập người liên hệ thủ công</option>{(data?.customers || []).map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></Field>
            <Field label="Máy / sản phẩm cần xử lý" className="span-6"><select value={form.machineId} onChange={(event) => setForm({ ...form, machineId: event.target.value })}><option value="">Chưa xác định máy</option>{customerMachines.map((machine) => <option key={machine.id} value={machine.id}>{machine.id} · {machine.name || machine.model}</option>)}</select></Field>
            <Field label="Tên người liên hệ" className="span-6"><input required value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })}/></Field>
            <Field label="Số điện thoại" className="span-6"><input required value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value.replace(/\D/g, "") })}/></Field>
            <Field label="Nhân viên phụ trách" className="span-6"><select value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}><option value="">Chưa phân công</option>{(data?.staff || []).map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></Field>
            <Field label="Đại lý dự kiến" className="span-6"><select value={form.dealerId} onChange={(event) => setForm({ ...form, dealerId: event.target.value })}><option value="">Để Điều phối lựa chọn</option>{(data?.dealers || []).map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.dealerCode} · {dealer.name}</option>)}</select></Field>
            <Field label="Tiêu đề yêu cầu" className="span-12"><input required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Ví dụ: Máy rò nước, cần kiểm tra trong ngày"/></Field>
            <Field label="Mô tả chi tiết" className="span-12"><textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Hiện tượng, thời điểm phát sinh, mong muốn của khách hàng..."/></Field>
          </div>
          <RequirementRestatement form={form} machineLabel={data?.machines.find((machine) => machine.id === form.machineId)?.name || data?.machines.find((machine) => machine.id === form.machineId)?.model}/>
        </div>
        <div className="modal-footer"><button type="button" onClick={() => setOpen(false)} className="btn-secondary">Hủy</button><button disabled={busy} className="btn-primary px-6 py-3 font-black text-white disabled:opacity-60">{busy ? "Đang tạo..." : "Tạo phiếu & chuyển Điều phối"}</button></div>
      </form>
    </div>}
  </main>;
}

function TicketDetail({ ticket, data, reply, setReply, busy, update }: { ticket: Ticket; data: Data; reply: string; setReply: (value: string) => void; busy: boolean; update: (payload: Record<string, unknown>) => Promise<void> }) {
  return <div>
    <div className="border-b p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">{ticket.ticketCode}</p><h2 className="mt-1 text-xl font-black">{ticket.subject}</h2><p className="mt-1 text-xs font-semibold text-slate-500">Phiếu hỗ trợ</p></div><div className="flex gap-2"><StatusBadge value={ticket.priority}/><StatusBadge value={ticket.status}/></div></div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{ticket.description || "Không có mô tả."}</p>
    </div>
    <div className="space-y-5 p-5">
      <section className="requirement-summary">
        <div className="flex items-center gap-2"><span className="summary-icon"><Icon name="file" size={18}/></span><div><h3 className="font-black">Mô tả lại yêu cầu</h3><p className="text-xs text-slate-500">Thông tin đã được chuẩn hóa để CSKH, Điều phối và Đại lý cùng hiểu.</p></div></div>
        <dl className="summary-grid mt-4">
          <Summary label="Khách hàng" value={`${ticket.contactName} · ${ticket.contactPhone}`}/>
          <Summary label="Máy cần xử lý" value={ticket.machine ? `${ticket.machine.id} · ${ticket.machine.name || ticket.machine.model}` : "Chưa xác định"}/>
          <Summary label="Loại / ưu tiên" value={`${TYPE_LABEL[ticket.type] || ticket.type} · ${ticket.priority === "CRITICAL" ? "Khẩn cấp" : ticket.priority === "HIGH" ? "Cao" : ticket.priority === "LOW" ? "Thấp" : "Bình thường"}`}/>
          <Summary label="Mong muốn" value={ticket.description || ticket.subject}/>
        </dl>
      </section>

      <section className={`dispatch-link-card ${ticket.serviceOrder ? "is-linked" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><span className="summary-icon"><Icon name="map" size={18}/></span><div><h3 className="font-black">Lệnh Điều phối</h3><p className="text-xs text-slate-500">Phiếu và lệnh dùng chung máy, khách hàng, đại lý và trạng thái xử lý.</p></div></div>{ticket.serviceOrder && <StatusBadge value={ticket.serviceOrder.status}/>}</div>
        {ticket.serviceOrder ? <div className="mt-4 rounded-2xl bg-white/80 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-emerald-700">{ticket.serviceOrder.orderCode}</p><p className="mt-1 font-black">{ticket.serviceOrder.serviceType}</p><p className="mt-1 text-xs text-slate-500">{ticket.serviceOrder.dealer?.name || "Chưa giao đại lý"} · Hạn {date(ticket.serviceOrder.dueDate)}</p></div><div className="flex flex-wrap gap-2"><Link href={`/admin/service-orders/${ticket.serviceOrder.id}`} className="btn-secondary text-xs"><Icon name="eye" size={15}/>Xem chi tiết lệnh</Link><Link href={`/operations-map?order=${ticket.serviceOrder.id}`} className="btn-primary px-3 py-2 text-xs font-black text-white"><Icon name="map" size={15}/>Mở Điều phối</Link></div></div></div> : ticket.machine ? <div className="mt-4"><Notice kind="warning">Phiếu cũ chưa có lệnh liên kết. Bấm nút dưới để tạo ngay, không cần nhập lại dữ liệu.</Notice><button type="button" disabled={busy} onClick={() => update({ ensureServiceOrder: true })} className="btn-primary mt-3 w-full justify-center px-4 py-3 font-black text-white disabled:opacity-60"><Icon name="plus" size={17}/>Tạo lệnh Điều phối từ phiếu</button></div> : <div className="mt-4"><Notice kind="warning">Chưa xác định máy nên chưa thể chuyển sang Điều phối. Hãy tạo lại phiếu và chọn đúng máy của khách hàng.</Notice></div>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="mb-1 block text-xs font-bold">Trạng thái</span><select value={ticket.status} disabled={busy} onChange={(event) => update({ status: event.target.value })}>{["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "CANCELLED"].map((value) => <option key={value} value={value}>{STATUS_FILTER_LABEL[value] || value}</option>)}</select></label>
        <label><span className="mb-1 block text-xs font-bold">Nhân viên phụ trách</span><select value={ticket.assignee?.id || ""} disabled={busy} onChange={(event) => update({ assigneeId: event.target.value })}><option value="">Chưa phân công</option>{(data?.staff || []).map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></label>
        <label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold">Đại lý xử lý</span><select value={ticket.dealer?.id || ""} disabled={busy} onChange={(event) => update({ dealerId: event.target.value, status: event.target.value ? "ASSIGNED" : "NEW" })}><option value="">Chưa giao đại lý</option>{(data?.dealers || []).map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.dealerCode} · {dealer.name}</option>)}</select></label>
      </div>

      <div><p className="mb-3 text-sm font-black">Lịch sử trao đổi</p><div className="timeline max-h-80 overflow-y-auto pr-2">{ticket.messages.map((item) => <div key={item.id} className="timeline-item"><div className="flex justify-between gap-3"><strong className="text-sm">{item.authorName}</strong><span className="text-[11px] text-slate-400">{date(item.createdAt)}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.message}</p>{item.isInternal && <span className="mt-1 inline-block text-[10px] font-bold text-amber-700">Ghi chú nội bộ</span>}</div>)}{!ticket.messages.length && <p className="text-sm text-slate-400">Chưa có trao đổi.</p>}</div></div>
      <label><span className="mb-1 block text-sm font-bold">Thêm trao đổi</span><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Nhập nội dung cập nhật..."/></label>
      <button type="button" disabled={busy || !reply.trim()} onClick={() => update({ message: reply })} className="btn-primary w-full justify-center p-3 font-black text-white disabled:opacity-50"><Icon name="send" size={17}/>Gửi cập nhật</button>
    </div>
  </div>;
}

function RequirementRestatement({ form, machineLabel }: { form: TicketForm; machineLabel?: string }) {
  const willDispatch = Boolean(form.machineId && OPERATIONAL_TYPES.has(form.type));
  return <section className="requirement-summary">
    <div className="flex items-center gap-2"><span className="summary-icon"><Icon name="file" size={18}/></span><div><h3 className="font-black">Mô tả lại yêu cầu</h3><p className="text-xs text-slate-500">Kiểm tra nội dung hệ thống sẽ chuyển cho bộ phận Điều phối.</p></div></div>
    <dl className="summary-grid mt-4"><Summary label="Người yêu cầu" value={`${form.contactName || "Chưa nhập"} · ${form.contactPhone || "Chưa nhập"}`}/><Summary label="Thiết bị" value={form.machineId ? `${form.machineId}${machineLabel ? ` · ${machineLabel}` : ""}` : "Chưa chọn máy"}/><Summary label="Nhu cầu" value={`${TYPE_LABEL[form.type] || form.type}: ${form.subject || "Chưa nhập tiêu đề"}`}/><Summary label="Luồng sau khi lưu" value={willDispatch ? "Tự động tạo lệnh mới/đã giao và hiển thị ngay tại Điều phối" : "Chỉ lưu phiếu; cần bổ sung máy để tạo lệnh Điều phối"}/></dl>
  </section>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) { return <label className={className}><span className="mb-1 block text-sm font-bold">{label}</span>{children}</label>; }
