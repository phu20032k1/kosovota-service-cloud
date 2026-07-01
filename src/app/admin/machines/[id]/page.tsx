"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";

type MachineDetail = {
  id: string;
  serial?: string | null;
  name?: string | null;
  model: string;
  capacity?: string | null;
  specification?: string | null;
  warrantyMonths?: number | null;
  status: string;
  provinceCode?: string | null;
  manufactureDate?: string | null;
  installDate?: string | null;
  lat?: number | null;
  lng?: number | null;
  customer?: { name?: string | null; phone?: string | null; address?: string | null } | null;
  activations?: Array<{ id: string; step: number; createdAt: string; ownerName?: string | null; ownerPhone?: string | null; address?: string | null; lat?: number | null; lng?: number | null }>;
  serviceOrders?: Array<{ id: string; serviceType: string; status: string; createdAt: string; dueDate?: string | null }>;
  serviceReports?: Array<{ id: string; serviceType: string; status: string; createdAt: string; note?: string | null }>;
  maintenanceSchedules?: Array<{ id: string; title: string; status: string; dueDate: string }>;
};

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "—";
}

function yesNo(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function isActivatedMachine(machine: MachineDetail) {
  return Boolean(machine.customer?.phone || machine.installDate || ["ACTIVE", "ACTIVATED", "INSTALLED"].includes(machine.status));
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words font-extrabold text-slate-900">{yesNo(value)}</p></div>;
}

export default function AdminMachineDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [machine, setMachine] = useState<MachineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/machines/${encodeURIComponent(id)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Không tải được chi tiết máy");
        setMachine(result.data);
      } catch (value) {
        setError(value instanceof Error ? value.message : "Không tải được chi tiết máy");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  return <main className="min-h-screen bg-slate-100">
    <OperationsHeader title="Chi tiết máy" subtitle="Hồ sơ máy, khách hàng, bảo hành, QR và lịch sử chăm sóc" actions={<Link href="/admin/reports" className="icon-button" title="Quay lại danh sách"><Icon name="database" size={18}/></Link>} />
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      {loading && <LoadingState label="Đang tải chi tiết máy..." />}
      {error && <Notice kind="error">{error}</Notice>}
      {machine && <>
        <section className="surface-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{isActivatedMachine(machine) ? "Máy cũ / đã kích hoạt" : "Máy mới / chưa kích hoạt"}</p>
              <h1 className="mt-2 break-all text-2xl font-black text-slate-950">{machine.id}</h1>
              <p className="mt-1 text-slate-600">{machine.name || "Thiết bị KOSOVOTA"} · {machine.model}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/reports" className="btn-secondary"><Icon name="database" size={18}/> Danh sách máy</Link>
              <Link href={`/qr/${encodeURIComponent(machine.id)}`} className="btn-secondary"><Icon name="qr" size={18}/> In QR</Link>
              <Link href={`/service-report/${encodeURIComponent(machine.id)}`} className="btn-primary px-4 py-3 font-bold text-white"><Icon name="wrench" size={18}/> Tạo báo cáo dịch vụ</Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="surface-card p-5 lg:col-span-2">
            <h2 className="text-lg font-black">Thông tin máy</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="ID/SERI" value={machine.id} />
              <InfoRow label="Seri cần in" value={machine.serial} />
              <InfoRow label="Tên máy" value={machine.name} />
              <InfoRow label="Model" value={machine.model} />
              <InfoRow label="Công suất" value={machine.capacity} />
              <InfoRow label="Bảo hành" value={machine.warrantyMonths ? `${machine.warrantyMonths} tháng` : null} />
              <InfoRow label="Năm SX" value={machine.manufactureDate ? new Date(machine.manufactureDate).getFullYear() : null} />
              <InfoRow label="Tỉnh" value={machine.provinceCode} />
              <InfoRow label="Trạng thái" value={machine.status} />
              <InfoRow label="Ngày lắp" value={date(machine.installDate)} />
              <InfoRow label="Vĩ độ" value={machine.lat} />
              <InfoRow label="Kinh độ" value={machine.lng} />
            </div>
            {machine.specification && <div className="mt-4 rounded-xl border bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Thông số/ghi chú từ Excel</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{machine.specification}</p></div>}
          </div>

          <div className="surface-card p-5">
            <h2 className="text-lg font-black">Khách hàng</h2>
            <div className="mt-4 space-y-3">
              <InfoRow label="Tên khách" value={machine.customer?.name} />
              <InfoRow label="SĐT" value={machine.customer?.phone} />
              <InfoRow label="Địa chỉ" value={machine.customer?.address} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="surface-card p-5">
            <h2 className="text-lg font-black">Lịch kích hoạt</h2>
            <div className="mt-3 divide-y">
              {(machine.activations || []).map((item) => <div key={item.id} className="py-3 text-sm"><p className="font-bold">Bước {item.step} · {date(item.createdAt)}</p><p className="text-slate-600">{item.ownerName || "—"} · {item.ownerPhone || "—"}</p></div>)}
              {(machine.activations || []).length === 0 && <p className="py-4 text-sm text-slate-500">Chưa có kích hoạt.</p>}
            </div>
          </div>
          <div className="surface-card p-5">
            <h2 className="text-lg font-black">Bảo trì tiếp theo</h2>
            <div className="mt-3 divide-y">
              {(machine.maintenanceSchedules || []).slice(0, 6).map((item) => <div key={item.id} className="py-3 text-sm"><p className="font-bold">{item.title}</p><p className="text-slate-600">{date(item.dueDate)} · {item.status}</p></div>)}
              {(machine.maintenanceSchedules || []).length === 0 && <p className="py-4 text-sm text-slate-500">Chưa có lịch bảo trì.</p>}
            </div>
          </div>
          <div className="surface-card p-5">
            <h2 className="text-lg font-black">Dịch vụ gần đây</h2>
            <div className="mt-3 divide-y">
              {(machine.serviceReports || []).slice(0, 6).map((item) => <div key={item.id} className="py-3 text-sm"><p className="font-bold">{item.serviceType} · {item.status}</p><p className="text-slate-600">{date(item.createdAt)}</p>{item.note && <p className="mt-1 text-slate-600">{item.note}</p>}</div>)}
              {(machine.serviceReports || []).length === 0 && <p className="py-4 text-sm text-slate-500">Chưa có báo cáo dịch vụ.</p>}
            </div>
          </div>
        </section>
      </>}
    </div>
  </main>;
}
