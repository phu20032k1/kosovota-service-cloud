"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";

type TicketMessage = {
  id: string;
  authorName: string;
  message: string;
  attachment?: string | null;
  isInternal: boolean;
  createdAt: string;
};
type Ticket = {
  id: string;
  ticketCode: string;
  type: string;
  subject: string;
  description?: string | null;
  status: string;
  priority: string;
  contactName: string;
  contactPhone: string;
  dueAt?: string | null;
  createdAt: string;
  customer?: { id: string; name: string; phone: string } | null;
  machine?: { id: string; model: string } | null;
  dealer?: { id: string; dealerCode: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
  messages: TicketMessage[];
};
type Option = { id: string; name: string; phone?: string };
type Data = {
  tickets: Ticket[];
  customers: Option[];
  machines: { id: string; model: string; customer?: Option | null }[];
  dealers: { id: string; dealerCode: string; name: string }[];
  staff: { id: string; name: string }[];
};
const date = (value?: string | null) => value
  ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
  : "—";

export default function TicketsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [form, setForm] = useState({ type: "WARRANTY", subject: "", description: "", priority: "NORMAL", customerId: "", machineId: "", dealerId: "", assigneeId: "", contactName: "", contactPhone: "", dueAt: "" });
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/support-tickets", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message);
      setData(result.data);
      setSelected((current) => current ? result.data.tickets.find((ticket: Ticket) => ticket.id === current.id) || current : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được ticket");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => data?.tickets.filter((ticket) => filter === "ALL" || ticket.status === filter) || [], [data, filter]);
  const stats = useMemo(() => ({
    open: data?.tickets.filter((ticket) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.status)).length || 0,
    critical: data?.tickets.filter((ticket) => ticket.priority === "CRITICAL" && !["RESOLVED", "CLOSED"].includes(ticket.status)).length || 0,
    waiting: data?.tickets.filter((ticket) => ticket.status === "WAITING_CUSTOMER").length || 0,
    resolved: data?.tickets.filter((ticket) => ["RESOLVED", "CLOSED"].includes(ticket.status)).length || 0,
  }), [data]);

  async function create(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/support-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok || !result.success) { setError(result.message); return; }
    setMessage(result.message);
    setOpen(false);
    setForm({ ...form, subject: "", description: "" });
    await load();
  }

  async function update(payload: Record<string, unknown>) {
    if (!selected) return;
    const response = await fetch(`/api/support-tickets/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.success) { setError(result.message); return; }
    setMessage(result.message);
    setReply("");
    await load();
  }

  function selectCustomer(id: string) {
    const customer = data?.customers.find((item) => item.id === id);
    setForm({ ...form, customerId: id, contactName: customer?.name || form.contactName, contactPhone: customer?.phone || form.contactPhone });
  }

  return (
    <main className="min-h-screen">
      <OperationsHeader title="Bảo hành & khiếu nại" subtitle="Theo dõi SLA, phân công xử lý và lưu toàn bộ trao đổi" actions={<button type="button" onClick={load} className="icon-button"><Icon name="refresh" size={18} /></button>} />
      <div className="page-container space-y-6">
        {message && <Notice kind="success">{message}</Notice>}
        {error && <Notice kind="error">{error}</Notice>}
        {loading && !data ? <LoadingState label="Đang tải yêu cầu hỗ trợ..." /> : data && <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Đang mở" value={stats.open} icon="alert" tone="blue" />
            <MetricCard label="Khẩn cấp" value={stats.critical} icon="bell" tone="rose" />
            <MetricCard label="Chờ khách hàng" value={stats.waiting} icon="clock" tone="amber" />
            <MetricCard label="Đã giải quyết" value={stats.resolved} icon="check" tone="emerald" />
          </section>

          <section className="split-panel">
            <article className="surface-card">
              <div className="data-toolbar">
                <div className="flex flex-wrap gap-2">
                  {["ALL", "NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"].map((status) => (
                    <button type="button" key={status} onClick={() => setFilter(status)} className={`rounded-xl px-3 py-2 text-xs font-bold ${filter === status ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{status === "ALL" ? "Tất cả" : status}</button>
                  ))}
                </div>
                <button type="button" onClick={() => setOpen(true)} className="btn-primary inline-flex items-center gap-2 px-4 py-3 font-black text-white"><Icon name="plus" size={17} />Tạo yêu cầu</button>
              </div>
              <div className="divide-y">
                {visible.map((ticket) => {
                  const attachments = ticket.messages.filter((item) => item.attachment).length;
                  return <button type="button" key={ticket.id} onClick={() => setSelected(ticket)} className={`w-full p-4 text-left hover:bg-emerald-50 ${selected?.id === ticket.id ? "bg-emerald-50" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{ticket.ticketCode} · {ticket.subject}</p>
                        <p className="mt-1 text-sm text-slate-600">{ticket.contactName} · {ticket.contactPhone} {ticket.machine ? `· ${ticket.machine.id}` : ""}</p>
                        <p className="mt-1 text-xs text-slate-400">Tạo {date(ticket.createdAt)} · Hạn {date(ticket.dueAt)}</p>
                        {attachments > 0 && <p className="mt-1 text-xs font-black text-blue-700">📷 {attachments} ảnh khách gửi</p>}
                      </div>
                      <div className="flex gap-2"><StatusBadge value={ticket.priority} /><StatusBadge value={ticket.status} /></div>
                    </div>
                  </button>;
                })}
                {!visible.length && <div className="empty-state"><div><Icon name="file" size={32} className="mx-auto mb-2" /><p className="font-bold">Không có yêu cầu phù hợp</p></div></div>}
              </div>
            </article>

            <aside className="surface-card h-fit xl:sticky xl:top-28">
              {selected ? <>
                <div className="border-b p-5">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">{selected.ticketCode}</p><h2 className="mt-1 text-xl font-black">{selected.subject}</h2></div><StatusBadge value={selected.priority} /></div>
                  <p className="mt-3 text-sm text-slate-600">{selected.description || "Không có mô tả."}</p>
                </div>
                <div className="space-y-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label><span className="mb-1 block text-xs font-bold">Trạng thái</span><select value={selected.status} onChange={(event) => update({ status: event.target.value })}>{["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "CANCELLED"].map((status) => <option key={status}>{status}</option>)}</select></label>
                    <label><span className="mb-1 block text-xs font-bold">Nhân viên phụ trách</span><select value={selected.assignee?.id || ""} onChange={(event) => update({ assigneeId: event.target.value })}><option value="">Chưa phân công</option>{data.staff.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></label>
                    <label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold">Đại lý xử lý</span><select value={selected.dealer?.id || ""} onChange={(event) => update({ dealerId: event.target.value })}><option value="">Chưa giao đại lý</option>{data.dealers.map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.dealerCode} · {dealer.name}</option>)}</select></label>
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-black">Lịch sử trao đổi</p>
                    <div className="timeline max-h-96 overflow-y-auto">
                      {selected.messages.map((item) => <div key={item.id} className="timeline-item">
                        <div className="flex justify-between gap-3"><strong className="text-sm">{item.authorName}</strong><span className="text-[11px] text-slate-400">{date(item.createdAt)}</span></div>
                        <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                        {item.attachment && <a href={item.attachment} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border bg-slate-50"><img src={item.attachment} alt={item.message || "Ảnh khách gửi"} className="max-h-56 w-full object-contain" /><span className="block p-2 text-center text-xs font-black text-blue-700">Mở ảnh gốc</span></a>}
                        {item.isInternal && <span className="mt-1 inline-block text-[10px] font-bold text-amber-700">Ghi chú nội bộ</span>}
                      </div>)}
                      {!selected.messages.length && <p className="text-sm text-slate-400">Chưa có trao đổi.</p>}
                    </div>
                  </div>

                  <label><span className="mb-1 block text-sm font-bold">Thêm trao đổi</span><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Nhập nội dung cập nhật..." /></label>
                  <button type="button" disabled={!reply.trim()} onClick={() => update({ message: reply })} className="btn-primary w-full p-3 font-black text-white disabled:opacity-50">Gửi cập nhật</button>
                </div>
              </> : <div className="empty-state"><div><Icon name="chevron-right" size={30} className="mx-auto mb-2" /><p className="font-bold">Chọn một yêu cầu để xử lý</p></div></div>}
            </aside>
          </section>
        </>}
      </div>

      {open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
        <form onSubmit={create} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <div className="mb-5 flex justify-between"><div><h3 className="text-xl font-black">Tạo yêu cầu hỗ trợ</h3><p className="text-sm text-slate-500">Bảo hành, khiếu nại, sửa chữa hoặc yêu cầu khác</p></div><button type="button" onClick={() => setOpen(false)} className="icon-button"><Icon name="x" size={18} /></button></div>
          <div className="form-grid">
            <Field label="Loại yêu cầu" className="span-4"><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="WARRANTY">Bảo hành</option><option value="COMPLAINT">Khiếu nại</option><option value="REPAIR">Sửa chữa</option><option value="CONSULTING">Tư vấn</option></select></Field>
            <Field label="Mức ưu tiên" className="span-4"><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="LOW">Thấp</option><option value="NORMAL">Bình thường</option><option value="HIGH">Cao</option><option value="CRITICAL">Khẩn cấp</option></select></Field>
            <Field label="Hạn xử lý" className="span-4"><input type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} /></Field>
            <Field label="Khách hàng" className="span-6"><select value={form.customerId} onChange={(event) => selectCustomer(event.target.value)}><option value="">Chọn khách hàng</option>{data?.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></Field>
            <Field label="Máy liên quan" className="span-6"><select value={form.machineId} onChange={(event) => setForm({ ...form, machineId: event.target.value })}><option value="">Không chọn máy</option>{data?.machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.id} · {machine.model}</option>)}</select></Field>
            <Field label="Người liên hệ" className="span-6"><input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></Field>
            <Field label="Số điện thoại" className="span-6"><input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} /></Field>
            <Field label="Tiêu đề" className="span-12"><input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></Field>
            <Field label="Mô tả" className="span-12"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <button className="btn-primary col-span-12 p-3 font-black text-white">Tạo yêu cầu</button>
          </div>
        </form>
      </div>}
    </main>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={className}><span className="mb-1 block text-sm font-bold">{label}</span>{children}</label>;
}
