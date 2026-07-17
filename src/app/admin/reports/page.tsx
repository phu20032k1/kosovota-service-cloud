"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ImportMachinesButton from "@/components/ImportMachinesButton";
import ImportDealersButton from "@/components/ImportDealersButton";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { downloadXlsx } from "@/lib/client-xlsx";

type Machine = {
  id: string;
  model: string;
  name?: string | null;
  capacity?: string | null;
  specification?: string | null;
  warrantyMonths?: number | null;
  serial?: string | null;
  provinceCode?: string | null;
  status: string;
  manufactureDate?: string | null;
  installDate?: string | null;
  lat?: number | null;
  lng?: number | null;
  buildingPhoto?: string | null;
  machinePhoto?: string | null;
  customer?: { name: string; phone: string; address?: string | null } | null;
  maintenanceSchedules: { dueDate: string; status: string; title: string }[];
};
type Dealer = {
  dealerCode: string;
  name: string;
  representativeName?: string | null;
  phone: string;
  province?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  services?: string | null;
  status: string;
  technicianCount?: number | null;
  serviceArea?: string | null;
  taxCode?: string | null;
  citizenId?: string | null;
  bankAccount?: string | null;
  accountHolder?: string | null;
  bankName?: string | null;
  createdAt: string;
};
type Order = {
  id: string;
  orderCode: string;
  serviceType: string;
  status: string;
  dueDate?: string | null;
  serviceFee?: number | null;
  paymentStatus?: string;
  customerName: string;
  customerPhone: string;
  dealer?: { dealerCode: string; name: string } | null;
  machine: { id: string };
};
type Sos = { id: string; machineId: string; customerName: string; customerPhone: string; status: string; priority: string; createdAt: string };
type Lead = { id: string; fullName: string; phone: string; productSlug?: string | null; province?: string | null; note?: string | null; status: string; createdAt: string };
type ReportData = { machines: Machine[]; dealers: Dealer[]; orders: Order[]; reports: unknown[]; sosTickets: Sos[]; leads: Lead[]; notifications: unknown[] };

function date(value?: string | null) { return value ? new Date(value).toLocaleDateString("vi-VN") : "—"; }
function nextSchedule(machine: Machine) { return machine.maintenanceSchedules.find((item) => !["COMPLETED", "DISABLED", "SELF_SERVICE"].includes(item.status)); }
function isActivatedMachine(machine: Machine) {
  return Boolean(machine.customer?.phone || machine.installDate || machine.status === "ACTIVE" || machine.status === "ACTIVATED" || machine.status === "INSTALLED");
}
function machineKindLabel(machine: Machine) {
  return isActivatedMachine(machine) ? "Máy cũ / đã kích hoạt" : "Máy mới / chưa kích hoạt";
}
function machineKindClass(machine: Machine) {
  return isActivatedMachine(machine) ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700";
}
function downloadTemplate(filename: string, headers: string[], sample: unknown[][]) {
  downloadXlsx(filename, "Mẫu nhập dữ liệu", headers, sample);
}

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [province, setProvince] = useState("");
  const [machineStatus, setMachineStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);
  const [deleteRequest, setDeleteRequest] = useState<string[] | null>(null);
  const [dealerStatusRequest, setDealerStatusRequest] = useState<{ codes: string[]; status: "APPROVED" | "REJECTED" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/reports", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được báo cáo");
      const nextData = result.data as ReportData;
      setData(nextData);
      setSelectedMachineIds((current) => current.filter((id) => nextData.machines.some((machine) => machine.id === id)));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được báo cáo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const machines = useMemo(() => (data?.machines || []).filter((machine) => {
    const text = `${machine.id} ${machine.serial || ""} ${machine.model} ${machine.name || ""} ${machine.customer?.name || ""} ${machine.customer?.phone || ""}`.toLowerCase();
    return (!province || machine.provinceCode === province)
      && (!machineStatus || (machineStatus === "NEW_ONLY" ? !isActivatedMachine(machine) : machineStatus === "OLD_ONLY" ? isActivatedMachine(machine) : machine.status === machineStatus))
      && (!search || text.includes(search.toLowerCase()));
  }), [data, province, machineStatus, search]);

  const provinces = [...new Set((data?.machines || []).map((machine) => machine.provinceCode).filter(Boolean))] as string[];
  const statuses = ["NEW_ONLY", "OLD_ONLY", ...new Set((data?.machines || []).map((machine) => machine.status))];
  const pendingDealers = (data?.dealers || []).filter((dealer) => dealer.status === "PENDING");
  const activeSos = (data?.sosTickets || []).filter((ticket) => !["COMPLETED", "CANCELLED"].includes(ticket.status));
  const completedOrders = (data?.orders || []).filter((order) => order.status === "COMPLETED");
  const revenue = completedOrders.reduce((sum, order) => sum + (order.serviceFee || 0), 0);
  const allVisibleMachinesSelected = machines.length > 0 && machines.every((machine) => selectedMachineIds.includes(machine.id));

  function toggleVisibleMachines() {
    if (allVisibleMachinesSelected) {
      setSelectedMachineIds((current) => current.filter((id) => !machines.some((machine) => machine.id === id)));
      return;
    }
    setSelectedMachineIds((current) => [...new Set([...current, ...machines.map((machine) => machine.id)])]);
  }

  function toggleMachine(id: string) {
    setSelectedMachineIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function updateDealers(dealerCodes: string | string[], status: "APPROVED" | "REJECTED") {
    const codes = Array.isArray(dealerCodes) ? dealerCodes : [dealerCodes];
    if (!codes.length) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/dealers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(codes.length === 1 ? { dealerCode: codes[0], status } : { dealerCodes: codes, status }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được đại lý");
      setMessage(result.message);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không cập nhật được đại lý");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMachines(machineIds: string | string[]) {
    const ids = Array.isArray(machineIds) ? machineIds : [machineIds];
    if (!ids.length) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/machines", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids.length === 1 ? { machineId: ids[0] } : { machineIds: ids }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không xóa được máy");
      setMessage(result.message);
      setSelectedMachineIds((current) => current.filter((id) => !ids.includes(id)));
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không xóa được máy");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteMachines() {
    if (!deleteRequest?.length) return;
    const ids = deleteRequest;
    setDeleteRequest(null);
    await deleteMachines(ids);
  }

  async function confirmDealerStatus() {
    if (!dealerStatusRequest?.codes?.length) return;
    const request = dealerStatusRequest;
    setDealerStatusRequest(null);
    await updateDealers(request.codes, request.status);
  }

  return <main className="page-shell">
    <OperationsHeader
      title="Điều hành toàn quốc"
      subtitle="KPI, dữ liệu máy, đại lý, dịch vụ và SOS"
      actions={<><Link href="/admin/integrations" className="icon-button" title="Tích hợp dịch vụ"><Icon name="settings" size={18}/></Link><Link href="/admin/notifications" className="icon-button" title="Trung tâm thông báo"><Icon name="bell" size={18}/></Link></>}
    />
    <div className="page-container space-y-6">
      {message && <Notice kind="success">{message}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Máy đã quản lý" value={data?.machines.length || 0} icon="droplet" />
        <MetricCard label="Đại lý được duyệt" value={data?.dealers.filter((d) => d.status === "APPROVED").length || 0} icon="store" tone="blue" />
        <MetricCard label="Hồ sơ chờ duyệt" value={pendingDealers.length} icon="users" tone="amber" />
        <MetricCard label="Lệnh đang xử lý" value={data?.orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status)).length || 0} icon="wrench" tone="violet" />
        <MetricCard label="SOS đang mở" value={activeSos.length} icon="alert" tone="rose" />
        <MetricCard label="Doanh thu dịch vụ" value={new Intl.NumberFormat("vi-VN").format(revenue) + "đ"} icon="wallet" tone="emerald" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card p-5 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Xuất / nhập dữ liệu vận hành</h2>
              <p className="mt-1 text-sm text-slate-500">Dùng Excel .xlsx thật để nhập/xuất.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => downloadTemplate("kosovota-mau-may.xlsx", ["ID máy", "Seri cần in", "Tên máy", "Model", "Công suất", "Bảo hành", "Năm sản xuất", "Tên khách hàng", "SĐT khách hàng", "Địa chỉ", "Tỉnh", "Vĩ độ", "Kinh độ", "Ngày lắp", "Trạng thái"], [["HT.0100.0626014", "HT.0100.0626014", "Tên máy: Máy lọc nước tinh khiết siêu sạch\nMã số: HT100-RU\nCông suất: 100L/H\nBảo hành: 12 tháng\nNăm sản xuất: 2026", "HT100-RU", "100L/H", "12 tháng", "2026", "Nguyễn Văn A", "0912345678", "Số 1 Hà Nội", "HN", "21.0278", "105.8342", "30/06/2026", "NEW"]])} className="rounded-xl border border-emerald-200 px-4 py-3 font-bold text-emerald-700">Tải mẫu máy</button>
              <button type="button" onClick={() => downloadTemplate("kosovota-mau-dai-ly.xlsx", ["Mã đại lý", "Tên đại lý", "Đại diện", "SĐT", "Tỉnh", "Địa chỉ", "Dịch vụ", "Trạng thái", "Số KTV", "Khu vực phụ trách", "Mã số thuế", "CCCD", "Số tài khoản", "Chủ tài khoản", "Ngân hàng", "Vĩ độ", "Kinh độ"], [["HN-DL-26-0001", "Đại lý Hà Nội 01", "Nguyễn Văn B", "0987654321", "Hà Nội", "Số 2 Hà Nội", "Lắp đặt, bảo trì", "APPROVED", "3", "Hà Nội", "0100000000", "001xxxxxxxx", "123456789", "NGUYEN VAN B", "VCB", "21.0278", "105.8342"]])} className="rounded-xl border border-blue-200 px-4 py-3 font-bold text-blue-700">Tải mẫu đại lý</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => downloadXlsx("kosovota-machines.xlsx", "Danh sách máy", ["ID máy", "Seri cần in", "Tên máy", "Model", "Công suất", "Bảo hành", "Năm sản xuất", "Tên khách hàng", "SĐT khách hàng", "Địa chỉ", "Tỉnh", "Vĩ độ", "Kinh độ", "Ngày lắp", "Trạng thái", "Thông tin máy", "Ảnh mặt tiền", "Ảnh máy", "Chăm sóc tiếp theo"], (data?.machines || []).map((m) => { const next = nextSchedule(m); return [m.id, m.serial, m.name, m.model, m.capacity, m.warrantyMonths ? `${m.warrantyMonths} tháng` : "", m.manufactureDate ? new Date(m.manufactureDate).getFullYear() : "", m.customer?.name, m.customer?.phone, m.customer?.address, m.provinceCode, m.lat, m.lng, date(m.installDate), m.status, m.specification, m.buildingPhoto, m.machinePhoto, next ? `${next.title} - ${date(next.dueDate)}` : ""]; }))} className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">Xuất Excel máy</button>
            <button type="button" onClick={() => downloadXlsx("kosovota-dealers.xlsx", "Danh sách đại lý", ["Mã đại lý", "Tên đại lý", "Đại diện", "SĐT", "Tỉnh", "Địa chỉ", "Dịch vụ", "Trạng thái", "Số KTV", "Khu vực phụ trách", "Mã số thuế", "CCCD", "Số tài khoản", "Chủ tài khoản", "Ngân hàng", "Vĩ độ", "Kinh độ"], (data?.dealers || []).map((d) => [d.dealerCode, d.name, d.representativeName, d.phone, d.province, d.address, d.services, d.status, d.technicianCount, d.serviceArea, d.taxCode, d.citizenId, d.bankAccount, d.accountHolder, d.bankName, d.lat, d.lng]))} className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Xuất Excel đại lý</button>
            <button type="button" onClick={() => downloadXlsx("kosovota-service-orders.xlsx", "Lịch sử chăm sóc", ["Mã lệnh", "Máy", "Khách hàng", "SĐT", "Dịch vụ", "Đại lý", "Hạn", "Trạng thái", "Phí"], (data?.orders || []).map((o) => [o.orderCode, o.machine.id, o.customerName, o.customerPhone, o.serviceType, o.dealer?.dealerCode, date(o.dueDate), o.status, o.serviceFee]))} className="rounded-xl bg-amber-600 px-4 py-3 font-bold text-white">Xuất Excel chăm sóc</button>
          </div>
        </div>
        <ImportMachinesButton onComplete={load} />
        <ImportDealersButton onComplete={load} />
      </section>

      <section className="surface-card">
        <div className="border-b p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Danh sách máy</h2>
              <p className="text-sm text-slate-500">Có thể chọn nhiều máy để xóa hàng loạt.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm ID, tên, SĐT..." className="rounded-xl border px-3 py-2" />
              <select value={province} onChange={(e) => setProvince(e.target.value)} className="rounded-xl border px-3 py-2"><option value="">Tất cả tỉnh</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select>
              <select value={machineStatus} onChange={(e) => setMachineStatus(e.target.value)} className="rounded-xl border px-3 py-2">
                <option value="">Tất cả máy</option>
                {statuses.map((item) => <option key={item} value={item}>{item === "NEW_ONLY" ? "Máy mới / chưa kích hoạt" : item === "OLD_ONLY" ? "Máy cũ / đã kích hoạt" : item}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={allVisibleMachinesSelected} onChange={toggleVisibleMachines} />
            Chọn tất cả đang lọc ({machines.length})
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-500">Đã chọn: {selectedMachineIds.length}</span>
            <button type="button" disabled={busy || selectedMachineIds.length === 0} onClick={() => setDeleteRequest(selectedMachineIds)} className="danger-button text-sm disabled:opacity-50"><Icon name="trash" size={16}/>Xóa máy hàng loạt</button>
          </div>
        </div>

        <div className="max-h-[68vh] overflow-auto pb-24 pr-4">
          <table className="min-w-[1480px] text-sm">
            <thead className="sticky top-0 z-10 bg-white text-left shadow-sm">
              <tr>{["Chọn", "Loại", "ID/Seri", "Tên máy", "Model", "Công suất", "Bảo hành", "Năm SX", "Khách hàng", "SĐT", "Tỉnh", "Trạng thái", "Ngày lắp", "Chăm sóc tiếp theo", "Thao tác"].map((h) => <th key={h} className={h === "Thao tác" ? "sticky right-0 z-20 whitespace-nowrap bg-white p-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]" : "whitespace-nowrap p-3"}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {machines.map((machine) => {
                const next = nextSchedule(machine);
                return <tr key={machine.id} className="border-b align-top hover:bg-slate-50">
                  <td className="p-3"><input type="checkbox" checked={selectedMachineIds.includes(machine.id)} onChange={() => toggleMachine(machine.id)} aria-label={`Chọn ${machine.id}`} /></td>
                  <td className="p-3"><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-extrabold ${machineKindClass(machine)}`}>{machineKindLabel(machine)}</span></td>
                  <td className="whitespace-nowrap p-3 font-black text-blue-700">{machine.id}</td>
                  <td className="min-w-[190px] p-3"><strong>{machine.name || "Thiết bị KOSOVOTA"}</strong></td>
                  <td className="whitespace-nowrap p-3">{machine.model}</td>
                  <td className="whitespace-nowrap p-3">{machine.capacity || "—"}</td>
                  <td className="whitespace-nowrap p-3">{machine.warrantyMonths ? `${machine.warrantyMonths} tháng` : "—"}</td>
                  <td className="whitespace-nowrap p-3">{machine.manufactureDate ? new Date(machine.manufactureDate).getFullYear() : "—"}</td>
                  <td className="min-w-[150px] p-3">{machine.customer?.name || "—"}</td>
                  <td className="whitespace-nowrap p-3">{machine.customer?.phone || "—"}</td>
                  <td className="whitespace-nowrap p-3">{machine.provinceCode || "—"}</td>
                  <td className="whitespace-nowrap p-3 font-bold">{machine.status}</td>
                  <td className="whitespace-nowrap p-3">{date(machine.installDate)}</td>
                  <td className="min-w-[190px] p-3">{next ? `${next.title} · ${date(next.dueDate)}` : "Không còn lịch mở"}</td>
                  <td className="sticky right-0 z-[1] whitespace-nowrap bg-white p-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                    <div className="flex gap-2">
                      <Link href={`/admin/machines/${encodeURIComponent(machine.id)}`} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Xem chi tiết</Link>
                      <Link href={`/qr/${encodeURIComponent(machine.id)}`} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">In QR</Link>
                      <Link href={`/service-report/${encodeURIComponent(machine.id)}`} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Dịch vụ</Link>
                      <button type="button" disabled={busy} onClick={() => setDeleteRequest([machine.id])} className="ghost-danger px-3 py-2 text-xs disabled:opacity-50"><Icon name="trash" size={14}/>Xóa</button>
                    </div>
                  </td>
                </tr>;
              })}
              {!loading && machines.length === 0 && <tr><td colSpan={15} className="p-10 text-center text-slate-500">Không có dữ liệu phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="surface-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <h2 className="text-xl font-black">Hồ sơ đại lý chờ duyệt</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || pendingDealers.length === 0} onClick={() => setDealerStatusRequest({ codes: pendingDealers.map((dealer) => dealer.dealerCode), status: "APPROVED" })} className="rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50">Duyệt tất cả</button>
              <button type="button" disabled={busy || pendingDealers.length === 0} onClick={() => setDealerStatusRequest({ codes: pendingDealers.map((dealer) => dealer.dealerCode), status: "REJECTED" })} className="rounded-lg bg-rose-600 px-3 py-2 font-bold text-white disabled:opacity-50">Từ chối tất cả</button>
            </div>
          </div>
          <div className="divide-y">
            {pendingDealers.map((dealer) => <article key={dealer.dealerCode} className="p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-black">{dealer.dealerCode} · {dealer.name}</p>
                  <p className="text-sm text-slate-600">{dealer.representativeName} · {dealer.phone} · {dealer.province}</p>
                  <p className="mt-1 text-sm">{dealer.services}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => setDealerStatusRequest({ codes: [dealer.dealerCode], status: "APPROVED" })} className="rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50">Duyệt</button>
                  <button type="button" disabled={busy} onClick={() => setDealerStatusRequest({ codes: [dealer.dealerCode], status: "REJECTED" })} className="rounded-lg bg-rose-600 px-3 py-2 font-bold text-white disabled:opacity-50">Từ chối</button>
                </div>
              </div>
            </article>)}
            {pendingDealers.length === 0 && <p className="p-8 text-center text-slate-500">Không có hồ sơ chờ duyệt.</p>}
          </div>
        </div>

        <div className="surface-card">
          <div className="border-b p-5"><h2 className="text-xl font-black">Yêu cầu tư vấn sản phẩm</h2></div>
          <div className="max-h-96 divide-y overflow-y-auto">
            {(data?.leads || []).map((lead) => <article key={lead.id} className="p-5"><p className="font-black">{lead.fullName} · <a href={`tel:${lead.phone}`} className="text-emerald-700">{lead.phone}</a></p><p className="text-sm text-slate-600">{lead.productSlug || "Tư vấn chung"} · {lead.province || "Chưa chọn tỉnh"} · {date(lead.createdAt)}</p>{lead.note && <p className="mt-1 text-sm">{lead.note}</p>}</article>)}
            {(data?.leads || []).length === 0 && <p className="p-8 text-center text-slate-500">Chưa có yêu cầu tư vấn.</p>}
          </div>
        </div>
      </section>

      <section className="surface-card">
        <div className="border-b p-5"><h2 className="text-xl font-black">SOS ưu tiên cao</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left"><tr>{["Máy", "Khách hàng", "SĐT", "Tiếp nhận", "Trạng thái"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>{(data?.sosTickets || []).map((ticket) => <tr key={ticket.id} className="border-b"><td className="p-3 font-black">{ticket.machineId}</td><td className="p-3">{ticket.customerName}</td><td className="p-3"><a href={`tel:${ticket.customerPhone}`} className="text-emerald-700">{ticket.customerPhone}</a></td><td className="p-3">{date(ticket.createdAt)}</td><td className="p-3 font-bold">{ticket.status}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>

    <ConfirmDialog
      open={Boolean(deleteRequest)}
      tone="danger"
      title="Xóa máy đã chọn?"
      description="Thao tác này xóa máy cùng dữ liệu kích hoạt, bảo trì, ticket, SOS và lệnh dịch vụ liên quan. Chỉ tiếp tục khi chắc chắn dữ liệu không còn cần dùng."
      highlight={deleteRequest?.length === 1 ? deleteRequest[0] : `${deleteRequest?.length || 0} máy đã chọn`}
      confirmLabel="Xóa dữ liệu"
      busy={busy}
      onCancel={() => setDeleteRequest(null)}
      onConfirm={() => void confirmDeleteMachines()}
    />

    <ConfirmDialog
      open={Boolean(dealerStatusRequest)}
      tone={dealerStatusRequest?.status === "APPROVED" ? "info" : "warning"}
      title={dealerStatusRequest?.status === "APPROVED" ? "Duyệt hồ sơ đại lý?" : "Từ chối hồ sơ đại lý?"}
      description="Hệ thống sẽ cập nhật trạng thái hàng loạt và tạo thông báo gửi đến đại lý. Hãy kiểm tra danh sách trước khi xác nhận."
      highlight={dealerStatusRequest?.codes?.length === 1 ? dealerStatusRequest.codes[0] : `${dealerStatusRequest?.codes?.length || 0} hồ sơ`}
      confirmLabel="Xác nhận"
      busy={busy}
      onCancel={() => setDealerStatusRequest(null)}
      onConfirm={() => void confirmDealerStatus()}
    />
  </main>;
}
