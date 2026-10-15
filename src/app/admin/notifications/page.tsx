"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";

type Notification = {
  id: string;
  phone?: string | null;
  email?: string | null;
  channel: string;
  subject?: string | null;
  content: string;
  status: string;
  createdAt: string;
};

type NoticeState = { kind: "success" | "error" | "info"; text: string } | null;

const STATUS_OPTIONS = [
  ["PENDING", "Đang chờ"],
  ["PROCESSING", "Đang gửi"],
  ["SENT", "Đã gửi"],
  ["FAILED", "Thất bại"],
] as const;

function channelLabel(channel: string) {
  if (channel === "EMAIL") return "Gmail";
  if (channel === "ZALO") return "Zalo";
  if (channel === "SMS") return "SMS";
  return "Thông báo";
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);
  const [single, setSingle] = useState({ channel: "EMAIL", email: "", phone: "", subject: "", content: "" });
  const [broadcast, setBroadcast] = useState({ audience: "ALL", subject: "", content: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được thông báo.");
      setItems(result.data || []);
    } catch (value) {
      setNotice({ kind: "error", text: value instanceof Error ? value.message : "Không tải được dữ liệu." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${item.phone || ""} ${item.email || ""} ${item.subject || ""} ${item.content}`.toLowerCase();
    return (!status || item.status === status) && (!search || haystack.includes(search.toLowerCase()));
  }), [items, status, search]);

  async function processQueue() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/notifications/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 50 }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không xử lý được thông báo.");
      setNotice({ kind: "success", text: `Đã xử lý thông báo: gửi thành công ${result.data.sent}, chờ thử lại ${result.data.retried}, thất bại ${result.data.failed}.` });
      await load();
    } catch (value) {
      setNotice({ kind: "error", text: value instanceof Error ? value.message : "Không xử lý được thông báo." });
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: string) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không thể gửi lại.");
      setNotice({ kind: "success", text: "Đã đưa thông báo vào danh sách gửi lại." });
      await load();
    } catch (value) {
      setNotice({ kind: "error", text: value instanceof Error ? value.message : "Không thể gửi lại." });
    } finally {
      setBusy(false);
    }
  }

  async function createSingle() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(single) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tạo được thông báo.");
      setNotice({ kind: "success", text: "Đã thêm thông báo vào danh sách gửi." });
      setSingle((old) => ({ ...old, email: "", phone: "", subject: "", content: "" }));
      await load();
    } catch (value) {
      setNotice({ kind: "error", text: value instanceof Error ? value.message : "Không tạo được thông báo." });
    } finally {
      setBusy(false);
    }
  }

  async function createBroadcast() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/notifications/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(broadcast) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không gửi hàng loạt được.");
      setNotice({ kind: "success", text: result.message || "Đã tạo thông báo hàng loạt." });
      setBroadcast((old) => ({ ...old, subject: "", content: "" }));
      await load();
    } catch (value) {
      setNotice({ kind: "error", text: value instanceof Error ? value.message : "Không gửi hàng loạt được." });
    } finally {
      setBusy(false);
    }
  }

  async function createMaintenanceReminders() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/notifications/maintenance-reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 7 }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tạo được nhắc lịch bảo trì.");
      setNotice({ kind: "success", text: result.message || "Đã tạo nhắc lịch bảo trì." });
      await load();
    } catch (value) {
      setNotice({ kind: "error", text: value instanceof Error ? value.message : "Không tạo được nhắc lịch bảo trì." });
    } finally {
      setBusy(false);
    }
  }

  const count = (key: string) => items.filter((item) => item.status === key).length;

  return <main className="min-h-screen bg-slate-50/70">
    <OperationsHeader title="Trung tâm thông báo" subtitle="Theo dõi và gửi SMS, Zalo, Gmail" actions={<button type="button" className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white" onClick={processQueue} disabled={busy}><Icon name="send" size={17}/>{busy ? "Đang xử lý" : "Gửi thông báo"}</button>}/>
    <section className="mx-auto max-w-[1480px] space-y-5 p-3 sm:p-5">
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Tổng thông báo" value={items.length} icon="bell"/>
        <MetricCard label="Đang chờ" value={count("PENDING")} icon="clock" tone="amber"/>
        <MetricCard label="Đang gửi" value={count("PROCESSING")} icon="refresh" tone="blue"/>
        <MetricCard label="Đã gửi" value={count("SENT")} icon="check" tone="emerald"/>
        <MetricCard label="Thất bại" value={count("FAILED")} icon="alert" tone="rose"/>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="surface-card space-y-3 p-4">
          <h2 className="text-base font-extrabold text-slate-900">Gửi cho một người</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <select value={single.channel} onChange={(e)=>setSingle({...single, channel:e.target.value})}><option value="EMAIL">Gmail</option><option value="SMS">SMS</option><option value="ZALO">Zalo</option></select>
            {single.channel === "EMAIL" ? <input value={single.email} onChange={(e)=>setSingle({...single,email:e.target.value})} placeholder="Email người nhận"/> : <input value={single.phone} onChange={(e)=>setSingle({...single,phone:e.target.value})} placeholder="Số điện thoại"/>}
          </div>
          {single.channel === "EMAIL" && <input value={single.subject} onChange={(e)=>setSingle({...single,subject:e.target.value})} placeholder="Tiêu đề email"/>}
          <textarea rows={4} value={single.content} onChange={(e)=>setSingle({...single,content:e.target.value})} placeholder="Nội dung thông báo" />
          <button type="button" className="btn-primary px-4 py-2 text-sm text-white" disabled={busy} onClick={createSingle}><Icon name="send" size={16}/>Thêm vào danh sách gửi</button>
        </div>

        <div className="surface-card space-y-3 p-4">
          <h2 className="text-base font-extrabold text-slate-900">Gửi Gmail hàng loạt</h2>
          <select value={broadcast.audience} onChange={(e)=>setBroadcast({...broadcast,audience:e.target.value})}><option value="ALL">Tất cả khách hàng, đại lý và nhân sự</option><option value="CUSTOMERS">Tất cả khách hàng</option><option value="DEALERS">Tất cả đại lý</option><option value="USERS">Tất cả nhân sự đang hoạt động</option></select>
          <input value={broadcast.subject} onChange={(e)=>setBroadcast({...broadcast,subject:e.target.value})} placeholder="Tiêu đề email" />
          <textarea rows={4} value={broadcast.content} onChange={(e)=>setBroadcast({...broadcast,content:e.target.value})} placeholder="Nội dung gửi hàng loạt" />
          <button type="button" className="btn-primary px-4 py-2 text-sm text-white" disabled={busy} onClick={createBroadcast}><Icon name="send" size={16}/>Tạo email cho tất cả</button>
          <p className="text-xs text-slate-500">Chỉ hồ sơ có email mới nhận thông báo. Địa chỉ email trùng sẽ tự động được bỏ qua.</p>
        </div>
      </div>

      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Thông báo tự động</h2>
          <p className="mt-1 text-sm text-slate-500">Tạo email nhắc lịch bảo trì cho các máy sắp đến hạn trong 7 ngày tới.</p>
        </div>
        <button type="button" className="btn-secondary px-4 py-2 text-sm" disabled={busy} onClick={createMaintenanceReminders}><Icon name="calendar" size={16}/>Tạo nhắc lịch 7 ngày</button>
      </div>

      <div className="surface-card grid gap-3 p-3 md:grid-cols-[1fr_220px_auto]">
        <label className="relative"><Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input className="pl-11" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Tìm số điện thoại, email, tiêu đề hoặc nội dung"/></label>
        <select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{STATUS_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        <button type="button" className="btn-secondary" onClick={()=>{setSearch("");setStatus("");}}><Icon name="x" size={17}/>Xóa lọc</button>
      </div>

      {loading ? <LoadingState/> : <div className="table-shell">
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead><tr>{["Thời gian","Kênh","Người nhận","Tiêu đề/Nội dung","Trạng thái","Thao tác"].map((h)=><th key={h} className="p-3 text-left">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((item)=><tr key={item.id}>
                <td className="whitespace-nowrap p-3 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                <td className="p-3"><span className="status-pill status-blue">{channelLabel(item.channel)}</span></td>
                <td className="p-3 font-bold">{item.email || item.phone || "—"}</td>
                <td className="max-w-md p-3"><p className="font-bold">{item.subject || "Thông báo"}</p><p className="line-clamp-2 leading-5">{item.content}</p>{item.status === "FAILED" && <p className="mt-1 text-xs font-semibold text-rose-600">Chưa gửi được. Có thể thử lại.</p>}</td>
                <td className="p-3"><Status value={item.status}/></td>
                <td className="p-3">{item.status === "FAILED" && <button type="button" disabled={busy} onClick={()=>retry(item.id)} className="btn-secondary px-3 py-2 text-xs"><Icon name="refresh" size={15}/>Thử lại</button>}</td>
              </tr>)}
              {!filtered.length && <tr><td colSpan={6} className="p-12 text-center text-slate-500">Không có thông báo phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {filtered.map((item)=><article key={item.id} className="p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="status-pill status-blue">{channelLabel(item.channel)}</span><Status value={item.status}/></div><p className="mt-2 break-words text-sm font-black text-slate-950">{item.subject || "Thông báo"}</p><p className="mt-1 break-all text-xs font-bold text-emerald-700">{item.email || item.phone || "—"}</p></div>
              <span className="shrink-0 text-right text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString("vi-VN")}</span>
            </div>
            <p className="mt-3 break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.content}</p>
            {item.status === "FAILED" && <><p className="mt-2 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">Chưa gửi được thông báo này.</p><button type="button" disabled={busy} onClick={()=>retry(item.id)} className="btn-secondary mt-3 w-full px-3 py-3 text-sm font-black"><Icon name="refresh" size={15}/>Thử lại</button></>}
          </article>)}
          {!filtered.length && <p className="p-10 text-center text-slate-500">Không có thông báo phù hợp.</p>}
        </div>
      </div>}
    </section>
  </main>;
}

function Status({ value }: { value: string }) {
  const cls = value === "SENT" ? "status-green" : value === "FAILED" ? "status-red" : value === "PROCESSING" ? "status-blue" : "status-amber";
  const label = STATUS_OPTIONS.find(([key]) => key === value)?.[1] || "Đang chờ";
  return <span className={`status-pill ${cls}`}>{label}</span>;
}
