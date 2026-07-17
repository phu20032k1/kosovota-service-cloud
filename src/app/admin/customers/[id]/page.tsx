"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Activity = { id: string; type: string; summary: string; detail?: string | null; occurredAt: string };
type Order = { id: string; orderCode: string; serviceType: string; status: string; createdAt: string; dealer?: { name: string } | null };
type Machine = { id: string; serial?: string | null; name?: string | null; model: string; status: string; manufactureDate?: string | null; installDate?: string | null; activations: { id: string; step: number; createdAt: string }[]; maintenanceSchedules: { id: string; title: string; dueDate: string; status: string }[]; serviceOrders: Order[]; serviceReports: { id: string; serviceType: string; createdAt: string }[] };
type Ticket = { id: string; ticketCode: string; subject: string; status: string; priority: string; createdAt: string; assignee?: { name: string } | null; dealer?: { name: string } | null };
type Customer = { id: string; name: string; phone: string; address?: string | null; segment?: string | null; satisfaction?: number | null; nextContactAt?: string | null; lastContactAt?: string | null; owner?: { name: string } | null; machines: Machine[]; activities: Activity[]; tickets: Ticket[] };
type TimelineEvent = { id: string; at: string; type: string; title: string; detail?: string | null; machineId?: string };
const date = (value?: string | null, withTime = true) => value ? new Intl.DateTimeFormat("vi-VN", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value)) : "—";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activity, setActivity] = useState({ type: "CALL", summary: "", detail: "", nextContactAt: "" });
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await fetch(`/api/crm/customers/${id}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message); setData(result.data); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không tải được hồ sơ"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!data) return [];
    return [
      ...data.activities.map((item) => ({ id: `activity-${item.id}`, at: item.occurredAt, type: item.type, title: item.summary, detail: item.detail })),
      ...data.machines.flatMap((machine) => [
        ...machine.serviceOrders.map((order) => ({ id: `order-${order.id}`, at: order.createdAt, type: "LỆNH DỊCH VỤ", title: `${order.orderCode} · ${order.serviceType}`, detail: `Trạng thái: ${order.status}${order.dealer?.name ? ` · Đại lý: ${order.dealer.name}` : ""}`, machineId: machine.id })),
        ...machine.serviceReports.map((report) => ({ id: `report-${report.id}`, at: report.createdAt, type: "BÁO CÁO XỬ LÝ", title: report.serviceType, detail: "Đại lý/KTV đã gửi báo cáo", machineId: machine.id })),
      ]),
      ...data.tickets.map((ticket) => ({ id: `ticket-${ticket.id}`, at: ticket.createdAt, type: "YÊU CẦU BH/SC", title: `${ticket.ticketCode} · ${ticket.subject}`, detail: `Trạng thái: ${ticket.status} · Mức độ: ${ticket.priority}` })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [data]);

  async function addActivity(event: FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch(`/api/crm/customers/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(activity) });
    const result = await response.json();
    if (!response.ok || !result.success) { setError(result.message); return; }
    setMessage(result.message); setActivity({ ...activity, summary: "", detail: "" }); await load();
  }
  async function update(payload: Record<string, unknown>) {
    const response = await fetch(`/api/crm/customers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.success) { setError(result.message); return; }
    setMessage(result.message); await load();
  }

  return <main className="min-h-screen"><OperationsHeader title={data?.name || "Hồ sơ khách hàng"} subtitle={data ? `${data.phone} · ${data.machines.length} thiết bị` : "CRM khách hàng 360°"} actions={<Link href="/admin/customers" className="btn-secondary"><Icon name="users" size={16}/>Danh sách</Link>}/><div className="page-container space-y-6">
    {message && <Notice kind="success">{message}</Notice>}{error && <Notice kind="error">{error}</Notice>}
    {loading && !data ? <LoadingState label="Đang mở hồ sơ khách hàng..."/> : data && <>
      <section className="grid gap-4 xl:grid-cols-[1fr_2fr]"><article className="surface-card p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">Hồ sơ khách hàng</p><h2 className="mt-1 text-2xl font-black">{data.name}</h2></div><span className={`status-badge ${data.segment === "VIP" ? "badge-violet" : "badge-slate"}`}>{data.segment || "STANDARD"}</span></div><div className="mt-5 space-y-3 text-sm"><p><strong>Điện thoại:</strong> <a className="text-emerald-700" href={`tel:${data.phone}`}>{data.phone}</a></p><p><strong>Địa chỉ:</strong> {data.address || "Chưa cập nhật"}</p><p><strong>CSKH phụ trách:</strong> {data.owner?.name || "Chưa phân công"}</p><p><strong>Liên hệ gần nhất:</strong> {date(data.lastContactAt)}</p><p><strong>Lịch tiếp theo:</strong> {date(data.nextContactAt)}</p></div><div className="mt-5 grid grid-cols-2 gap-3"><label><span className="mb-1 block text-xs font-bold">Phân khúc</span><select value={data.segment || "STANDARD"} onChange={(event) => void update({ segment: event.target.value })}><option>STANDARD</option><option>VIP</option><option>AT_RISK</option><option>INTERNAL</option></select></label><label><span className="mb-1 block text-xs font-bold">Hài lòng</span><select value={data.satisfaction || ""} onChange={(event) => void update({ satisfaction: Number(event.target.value) })}><option value="">Chưa đánh giá</option>{[1, 2, 3, 4, 5].map((number) => <option key={number}>{number}</option>)}</select></label></div></article>
        <article className="surface-card"><div className="data-toolbar"><div><h2 className="page-section-title">Thiết bị đang sở hữu</h2><p className="page-section-subtitle">Seri, tên máy, sản xuất, lắp đặt, kích hoạt và tình trạng xử lý</p></div></div><div className="grid gap-4 p-5 md:grid-cols-2">{data.machines.map((machine) => { const completed = machine.serviceOrders.filter((order) => ["COMPLETED", "CLOSED"].includes(order.status)).length; const activation = machine.activations.at(-1)?.createdAt; return <div key={machine.id} className="soft-card p-4"><div className="flex justify-between gap-3"><div><Link href={`/admin/machines/${encodeURIComponent(machine.id)}`} className="font-black text-emerald-700">{machine.name || machine.model}</Link><p className="text-xs text-slate-500">Seri: {machine.serial || machine.id} · Model: {machine.model}</p></div><StatusBadge value={machine.status}/></div><div className="mt-3 space-y-1 text-xs text-slate-600"><p><strong>Thời gian SX:</strong> {date(machine.manufactureDate, false)}</p><p><strong>Ngày lắp đặt:</strong> {date(machine.installDate, false)}</p><p><strong>Kích hoạt bảo hành:</strong> {date(activation, false)}</p></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white p-2"><strong>{machine.serviceOrders.length}</strong><p className="text-[10px] text-slate-500">Tổng lệnh</p></div><div className="rounded-xl bg-white p-2"><strong>{completed}</strong><p className="text-[10px] text-slate-500">Đã xử lý</p></div><div className="rounded-xl bg-white p-2"><strong>{machine.serviceOrders.length - completed}</strong><p className="text-[10px] text-slate-500">Chưa xử lý</p></div></div></div>; })}{!data.machines.length && <p className="text-sm text-slate-500">Khách hàng chưa có thiết bị.</p>}</div></article></section>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><article className="surface-card"><div className="data-toolbar"><div><h2 className="page-section-title">Dòng thời gian chăm sóc thực tế</h2><p className="page-section-subtitle">Tương tác, lệnh dịch vụ, báo cáo xử lý và yêu cầu BH/SC theo từng máy</p></div></div><div className="p-5"><div className="timeline">{timeline.map((item) => <div key={item.id} className="timeline-item"><div className="flex justify-between gap-3"><div><span className="status-badge badge-blue">{item.type}</span><strong className="ml-2 text-sm">{item.title}</strong>{item.machineId && <Link href={`/admin/machines/${encodeURIComponent(item.machineId)}`} className="ml-2 text-xs font-bold text-emerald-700">Máy {item.machineId}</Link>}</div><span className="text-xs text-slate-400">{date(item.at)}</span></div>{item.detail && <p className="mt-2 text-sm text-slate-600">{item.detail}</p>}</div>)}{!timeline.length && <p className="text-sm text-slate-500">Chưa có lịch sử thực tế.</p>}</div></div></article>
        <aside className="space-y-6"><form onSubmit={addActivity} className="surface-card p-5"><h2 className="page-section-title">Ghi nhận tương tác</h2><div className="mt-4 space-y-3"><select value={activity.type} onChange={(event) => setActivity({ ...activity, type: event.target.value })}><option value="CALL">Cuộc gọi</option><option value="ZALO">Zalo</option><option value="SMS">SMS</option><option value="VISIT">Gặp trực tiếp</option><option value="NOTE">Ghi chú</option></select><input value={activity.summary} onChange={(event) => setActivity({ ...activity, summary: event.target.value })} placeholder="Kết quả chính"/><textarea value={activity.detail} onChange={(event) => setActivity({ ...activity, detail: event.target.value })} placeholder="Nội dung chi tiết"/><label><span className="mb-1 block text-xs font-bold">Hẹn liên hệ lại</span><input type="datetime-local" value={activity.nextContactAt} onChange={(event) => setActivity({ ...activity, nextContactAt: event.target.value })}/></label><button className="btn-primary w-full p-3 font-black text-white">Lưu tương tác</button></div></form><article className="surface-card"><div className="data-toolbar"><div><h2 className="page-section-title">Yêu cầu bảo hành / sửa chữa</h2></div><Link href="/admin/tickets" className="icon-button"><Icon name="chevron-right" size={18}/></Link></div><div className="divide-y">{data.tickets.slice(0, 10).map((ticket) => <div key={ticket.id} className="p-4"><div className="flex justify-between gap-2"><strong className="text-sm">{ticket.ticketCode}</strong><StatusBadge value={ticket.status}/></div><p className="mt-1 text-sm text-slate-600">{ticket.subject}</p><p className="mt-1 text-xs text-slate-400">{date(ticket.createdAt)}</p></div>)}{!data.tickets.length && <p className="p-5 text-sm text-slate-500">Chưa có yêu cầu BH/SC.</p>}</div></article></aside></section>
    </>}
  </div></main>;
}
