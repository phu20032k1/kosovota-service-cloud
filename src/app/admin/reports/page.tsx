"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ImportMachinesButton from "@/components/ImportMachinesButton";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";

type Machine = { id: string; model: string; name?: string | null; capacity?: string | null; warrantyMonths?: number | null; serial?: string | null; provinceCode?: string | null; status: string; installDate?: string | null; customer?: { name: string; phone: string; address?: string | null } | null; maintenanceSchedules: { dueDate: string; status: string; title: string }[] };
type Dealer = { dealerCode: string; name: string; representativeName?: string | null; phone: string; province?: string | null; services?: string | null; status: string; createdAt: string };
type Order = { id: string; orderCode: string; serviceType: string; status: string; dueDate?: string | null; serviceFee?: number | null; paymentStatus?: string; customerName: string; customerPhone: string; dealer?: { dealerCode: string; name: string } | null; machine: { id: string } };
type Sos = { id: string; machineId: string; customerName: string; customerPhone: string; status: string; priority: string; createdAt: string };
type Lead = { id: string; fullName: string; phone: string; productSlug?: string | null; province?: string | null; note?: string | null; status: string; createdAt: string };
type ReportData = { machines: Machine[]; dealers: Dealer[]; orders: Order[]; reports: unknown[]; sosTickets: Sos[]; leads: Lead[]; notifications: unknown[] };

function date(value?: string | null) { return value ? new Date(value).toLocaleDateString("vi-VN") : "—"; }
function nextSchedule(machine: Machine) { return machine.maintenanceSchedules.find((item) => !["COMPLETED", "DISABLED", "SELF_SERVICE"].includes(item.status)); }
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const content = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [province, setProvince] = useState("");
  const [machineStatus, setMachineStatus] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/reports", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được báo cáo");
      setData(result.data);
    } catch (value) { setError(value instanceof Error ? value.message : "Không tải được báo cáo"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const machines = useMemo(() => (data?.machines || []).filter((machine) => {
    const text = `${machine.id} ${machine.serial || ""} ${machine.model} ${machine.name || ""} ${machine.customer?.name || ""} ${machine.customer?.phone || ""}`.toLowerCase();
    return (!province || machine.provinceCode === province) && (!machineStatus || machine.status === machineStatus) && (!search || text.includes(search.toLowerCase()));
  }), [data, province, machineStatus, search]);
  const provinces = [...new Set((data?.machines || []).map((machine) => machine.provinceCode).filter(Boolean))] as string[];
  const statuses = [...new Set((data?.machines || []).map((machine) => machine.status))];
  const pendingDealers = (data?.dealers || []).filter((dealer) => dealer.status === "PENDING");
  const activeSos = (data?.sosTickets || []).filter((ticket) => !["COMPLETED", "CANCELLED"].includes(ticket.status));
  const completedOrders = (data?.orders || []).filter((order) => order.status === "COMPLETED");
  const revenue = completedOrders.reduce((sum, order) => sum + (order.serviceFee || 0), 0);

  async function updateDealer(dealerCode: string, status: string) {
    const response = await fetch("/api/dealers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealerCode, status }) });
    const result = await response.json();
    if (!response.ok || !result.success) { setError(result.message || "Không cập nhật được đại lý"); return; }
    await load();
  }

  return <main className="min-h-screen bg-slate-100">
    <OperationsHeader title="Điều hành toàn quốc" subtitle="KPI, dữ liệu máy, đại lý, dịch vụ và SOS" actions={<><Link href="/admin/integrations" className="icon-button" title="Tích hợp dịch vụ"><Icon name="settings" size={18}/></Link><Link href="/admin/notifications" className="icon-button" title="Trung tâm thông báo"><Icon name="bell" size={18}/></Link></>} />
    <div className="mx-auto max-w-[1480px] space-y-6 p-4 sm:p-6">
      {error && <Notice kind="error">{error}</Notice>}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Máy đã quản lý" value={data?.machines.length || 0} icon="droplet" />
        <MetricCard label="Đại lý được duyệt" value={data?.dealers.filter((d) => d.status === "APPROVED").length || 0} icon="store" tone="blue" />
        <MetricCard label="Hồ sơ chờ duyệt" value={pendingDealers.length} icon="users" tone="amber" />
        <MetricCard label="Lệnh đang xử lý" value={data?.orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status)).length || 0} icon="wrench" tone="violet" />
        <MetricCard label="SOS đang mở" value={activeSos.length} icon="alert" tone="rose" />
        <MetricCard label="Doanh thu dịch vụ" value={new Intl.NumberFormat("vi-VN").format(revenue) + "đ"} icon="wallet" tone="emerald" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3"><div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Xuất dữ liệu vận hành</h2><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => downloadCsv("kosovota-machines.csv", ["ID máy", "Tên máy", "Model", "Công suất/Dung tích", "Bảo hành (tháng)", "Seri", "Khách hàng", "SĐT", "Địa chỉ", "Tỉnh", "Trạng thái", "Ngày lắp", "Chăm sóc tiếp theo"], (data?.machines || []).map((m) => [m.id, m.name, m.model, m.capacity, m.warrantyMonths, m.serial, m.customer?.name, m.customer?.phone, m.customer?.address, m.provinceCode, m.status, date(m.installDate), nextSchedule(m)?.title + " - " + date(nextSchedule(m)?.dueDate)]))} className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">Xuất danh sách máy</button><button type="button" onClick={() => downloadCsv("kosovota-dealers.csv", ["Mã", "Tên", "Đại diện", "SĐT", "Tỉnh", "Dịch vụ", "Trạng thái"], (data?.dealers || []).map((d) => [d.dealerCode, d.name, d.representativeName, d.phone, d.province, d.services, d.status]))} className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Xuất đại lý</button><button type="button" onClick={() => downloadCsv("kosovota-service-orders.csv", ["Mã lệnh", "Máy", "Khách hàng", "SĐT", "Dịch vụ", "Đại lý", "Hạn", "Trạng thái", "Phí"], (data?.orders || []).map((o) => [o.orderCode, o.machine.id, o.customerName, o.customerPhone, o.serviceType, o.dealer?.dealerCode, date(o.dueDate), o.status, o.serviceFee]))} className="rounded-xl bg-amber-600 px-4 py-3 font-bold text-white">Xuất lịch sử chăm sóc</button></div></div><ImportMachinesButton onComplete={load} /></section>

      <section className="surface-card"><div className="border-b p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Danh sách máy</h2><p className="text-sm text-slate-500">Lọc theo tỉnh, trạng thái, tên, số điện thoại hoặc ID máy.</p></div><div className="flex flex-wrap gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm máy/khách hàng" className="rounded-xl border px-3 py-2" /><select value={province} onChange={(e) => setProvince(e.target.value)} className="rounded-xl border px-3 py-2"><option value="">Tất cả tỉnh</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select><select value={machineStatus} onChange={(e) => setMachineStatus(e.target.value)} className="rounded-xl border px-3 py-2"><option value="">Tất cả trạng thái</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div></div></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left"><tr>{["ID/Seri", "Tên máy", "Model", "Công suất", "Khách hàng", "SĐT", "Tỉnh", "Trạng thái", "Ngày lắp", "Chăm sóc tiếp theo"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{machines.map((machine) => { const next = nextSchedule(machine); return <tr key={machine.id} className="border-b"><td className="p-3 font-black"><Link href={`/qr/${machine.id}`} className="text-blue-700">{machine.id}</Link></td><td className="p-3"><strong>{machine.name || "Thiết bị KOSOVOTA"}</strong></td><td className="p-3">{machine.model}</td><td className="p-3">{machine.capacity || "—"}</td><td className="p-3">{machine.customer?.name || "—"}</td><td className="p-3">{machine.customer?.phone || "—"}</td><td className="p-3">{machine.provinceCode || "—"}</td><td className="p-3 font-bold">{machine.status}</td><td className="p-3">{date(machine.installDate)}</td><td className="p-3">{next ? `${next.title} · ${date(next.dueDate)}` : "Không còn lịch mở"}</td></tr>; })}{!loading && machines.length === 0 && <tr><td colSpan={10} className="p-10 text-center text-slate-500">Không có dữ liệu phù hợp.</td></tr>}</tbody></table></div></section>

      <section className="grid gap-6 xl:grid-cols-2"><div className="surface-card"><div className="border-b p-5"><h2 className="text-xl font-black">Hồ sơ đại lý chờ duyệt</h2></div><div className="divide-y">{pendingDealers.map((dealer) => <article key={dealer.dealerCode} className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-black">{dealer.dealerCode} · {dealer.name}</p><p className="text-sm text-slate-600">{dealer.representativeName} · {dealer.phone} · {dealer.province}</p><p className="mt-1 text-sm">{dealer.services}</p></div><div className="flex gap-2"><button type="button" onClick={() => updateDealer(dealer.dealerCode, "APPROVED")} className="rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white">Duyệt</button><button type="button" onClick={() => updateDealer(dealer.dealerCode, "REJECTED")} className="rounded-lg bg-rose-600 px-3 py-2 font-bold text-white">Từ chối</button></div></div></article>)}{pendingDealers.length === 0 && <p className="p-8 text-center text-slate-500">Không có hồ sơ chờ duyệt.</p>}</div></div><div className="surface-card"><div className="border-b p-5"><h2 className="text-xl font-black">Yêu cầu tư vấn sản phẩm</h2></div><div className="max-h-96 divide-y overflow-y-auto">{(data?.leads || []).map((lead) => <article key={lead.id} className="p-5"><p className="font-black">{lead.fullName} · <a href={`tel:${lead.phone}`} className="text-emerald-700">{lead.phone}</a></p><p className="text-sm text-slate-600">{lead.productSlug || "Tư vấn chung"} · {lead.province || "Chưa chọn tỉnh"} · {date(lead.createdAt)}</p>{lead.note && <p className="mt-1 text-sm">{lead.note}</p>}</article>)}{(data?.leads || []).length === 0 && <p className="p-8 text-center text-slate-500">Chưa có yêu cầu tư vấn.</p>}</div></div></section>

      <section className="surface-card"><div className="border-b p-5"><h2 className="text-xl font-black">SOS ưu tiên cao</h2></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left"><tr>{["Máy", "Khách hàng", "SĐT", "Tiếp nhận", "Trạng thái"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{(data?.sosTickets || []).map((ticket) => <tr key={ticket.id} className="border-b"><td className="p-3 font-black">{ticket.machineId}</td><td className="p-3">{ticket.customerName}</td><td className="p-3"><a href={`tel:${ticket.customerPhone}`} className="text-emerald-700">{ticket.customerPhone}</a></td><td className="p-3">{date(ticket.createdAt)}</td><td className="p-3 font-bold">{ticket.status}</td></tr>)}</tbody></table></div></section>
    </div>
  </main>;
}
