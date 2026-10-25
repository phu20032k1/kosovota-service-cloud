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
  createdAt: string;
};

type Order = {
  id: string;
  orderCode: string;
  machineId: string;
  status: string;
  serviceType: string;
  customerName: string;
  customerPhone: string;
  address?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  dealer?: { dealerCode: string; name: string; phone: string } | null;
  technician?: { name: string; phone: string } | null;
  machine: {
    id: string;
    model: string;
    name?: string | null;
    serial?: string | null;
    status: string;
    installDate?: string | null;
    customer?: { name: string; phone: string; address?: string | null } | null;
  };
  reports: Report[];
  maintenanceSchedule?: { id: string; title: string; dueDate: string; status: string } | null;
};

function formatDate(value?: string | null, includeTime = true) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value));
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-2 break-words font-bold text-slate-900">{value}</p></div>;
}

export default function CskhServiceOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/service-orders/${id}`, { cache: "no-store" });
      const result = await readApiResponse<Order>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không tải được lệnh dịch vụ.");
      setOrder(result.data);
      setError("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được lệnh dịch vụ.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const reports = useMemo(() => (order?.reports || []).slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [order]);

  return <main className="min-h-screen bg-slate-100">
    <OperationsHeader
      title={order ? `Lệnh ${order.orderCode}` : "Chi tiết lệnh dịch vụ"}
      subtitle="Thông tin lệnh dịch vụ dành cho CSKH"
      actions={<button type="button" onClick={() => void load()} className="icon-button" title="Tải lại"><Icon name="refresh" size={18}/></button>}
    />

    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        <Link href="/csos" className="btn-secondary px-4 py-3 text-sm font-black"><Icon name="chevron-left" size={17}/>Công việc</Link>
        {order && <Link href={`/operations-map?order=${encodeURIComponent(order.id)}`} className="btn-primary px-4 py-3 text-sm font-black text-white"><Icon name="map" size={17}/>Mở điều phối</Link>}
      </div>

      {error && <Notice kind="error">{error}</Notice>}
      {loading ? <LoadingState label="Đang tải lệnh dịch vụ..."/> : !order ? <Notice kind="error">Không tìm thấy lệnh dịch vụ.</Notice> : <>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge value={order.status}/><span className="mini-chip">{order.orderCode}</span></div>
              <h2 className="mt-4 break-words text-2xl font-black tracking-[-.03em] text-slate-950">{order.serviceType}</h2>
              <p className="mt-2 text-sm text-slate-500">Tạo {formatDate(order.createdAt)} · Cập nhật {formatDate(order.updatedAt)}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Máy: {order.machineId}</div>
          </div>

          <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">Hạn xử lý</p><p className="mt-2 font-black">{formatDate(order.dueDate)}</p></div>
            <div className="bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">Đại lý</p><p className="mt-2 font-black">{order.dealer ? `${order.dealer.dealerCode} · ${order.dealer.name}` : "Chưa phân công"}</p></div>
            <div className="bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">Kỹ thuật viên</p><p className="mt-2 font-black">{order.technician?.name || "Chưa phân công"}</p></div>
            <div className="bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">Báo cáo hiện trường</p><p className="mt-2 font-black">{reports.length}</p></div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Khách hàng</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Tên khách hàng" value={order.machine.customer?.name || order.customerName}/>
              <Detail label="Số điện thoại" value={order.machine.customer?.phone || order.customerPhone}/>
              <div className="sm:col-span-2"><Detail label="Địa chỉ" value={order.machine.customer?.address || order.address || "Chưa cập nhật"}/></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`tel:${order.machine.customer?.phone || order.customerPhone}`} className="btn-secondary px-4 py-3 text-sm font-black"><Icon name="phone" size={17}/>Gọi khách hàng</a>
              <Link href={`/machine/${encodeURIComponent(order.machine.id)}`} className="btn-secondary px-4 py-3 text-sm font-black"><Icon name="droplet" size={17}/>Hồ sơ máy</Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Thiết bị & lịch</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Model" value={order.machine.model}/>
              <Detail label="Trạng thái máy" value={order.machine.status}/>
              <Detail label="Serial" value={order.machine.serial || "Chưa cập nhật"}/>
              <Detail label="Ngày lắp" value={formatDate(order.machine.installDate, false)}/>
            </div>
            {order.maintenanceSchedule && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-700">Lịch liên kết</p><p className="mt-2 font-black text-slate-900">{order.maintenanceSchedule.title}</p><p className="mt-1 text-sm text-slate-600">Đến hạn {formatDate(order.maintenanceSchedule.dueDate, false)} · {order.maintenanceSchedule.status}</p></div>}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Báo cáo hiện trường</p><h3 className="mt-1 text-xl font-black text-slate-950">Kết quả thực hiện dịch vụ</h3></div><span className="text-sm font-bold text-slate-500">{reports.length} báo cáo</span></div>
          {!reports.length ? <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">Chưa có báo cáo hiện trường.</p> : <div className="mt-5 space-y-3">{reports.map((report) => <article key={report.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-black text-slate-900">{report.serviceType}</h4><span className="text-xs font-semibold text-slate-400">{formatDate(report.createdAt)}</span></div><p className="mt-2 text-sm text-slate-600"><strong>Vật tư:</strong> {report.products || "Không ghi nhận"}</p><p className="mt-1 text-sm text-slate-600"><strong>Ghi chú:</strong> {report.note || "Không có"}</p></article>)}</div>}
        </section>
      </>}
    </div>
  </main>;
}
