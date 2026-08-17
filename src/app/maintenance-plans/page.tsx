"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PRODUCTS } from "@/data/products";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";

const TARGET_MODELS = ["RO_UNDER_30", "BCN_HOT_COLD", "BCN_COLUMN", "INDUSTRIAL"] as const;

type Schedule = {
  id: string;
  machineId: string;
  title: string;
  dueDate: string;
  status: string;
  machine: {
    id: string;
    model: string;
    status: string;
    provinceCode?: string | null;
    customer?: {
      name?: string | null;
      phone?: string | null;
      address?: string | null;
    } | null;
  };
  serviceOrder?: { id: string; orderCode?: string | null; status?: string | null } | null;
};

function intervalLabel(item: { monthsAfterInstallation?: number; daysAfterInstallation?: number }) {
  if (item.daysAfterInstallation) return `${item.daysAfterInstallation} ngày sau lắp đặt`;
  if (item.monthsAfterInstallation) return `${item.monthsAfterInstallation} tháng sau lắp đặt`;
  return "Theo cấu hình";
}

function dateOnly(value: string | Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function isReplacementTask(title: string) {
  return /thay|lõi|loi|màng|mang|vật liệu|vat lieu|bảo trì|bao tri/i.test(title);
}

export default function MaintenancePlansPage() {
  const plans = TARGET_MODELS.map((modelCode) => PRODUCTS.find((product) => product.modelCode === modelCode)).filter(Boolean);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/maintenance-schedules?status=PENDING", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được lịch bảo trì.");
      setSchedules(result.data || []);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được lịch bảo trì.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const { dueNow, upcoming } = useMemo(() => {
    const today = dateOnly(new Date());
    const next7 = new Date(today);
    next7.setDate(next7.getDate() + 7);

    const replacementSchedules = schedules.filter((item) => isReplacementTask(item.title));
    return {
      dueNow: replacementSchedules.filter((item) => dateOnly(item.dueDate) <= today),
      upcoming: replacementSchedules.filter((item) => {
        const due = dateOnly(item.dueDate);
        return due > today && due <= next7;
      }),
    };
  }, [schedules]);

  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader
        title="Lịch thay lõi"
        subtitle="4 bảng chu kỳ theo dòng máy và danh sách máy đã đến hạn cần xử lý"
        actions={
          <button type="button" onClick={loadSchedules} className="icon-button" title="Tải lại lịch">
            <Icon name="refresh" size={18} />
          </button>
        }
      />

      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <section className="surface-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <p className="eyebrow">Theo dõi thực tế</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Máy cần thay lõi / bảo trì</h2>
              <p className="mt-1 text-sm text-slate-500">Máy quá hạn hoặc đến hạn hôm nay được đưa lên đầu; máy trong 7 ngày tới hiển thị ở phần sắp đến hạn.</p>
            </div>
            <div className="flex gap-2">
              <span className="status-pill status-rose">Đến hạn: {dueNow.length}</span>
              <span className="status-pill status-slate">7 ngày tới: {upcoming.length}</span>
            </div>
          </div>

          {error && <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>}
          {loading ? (
            <div className="p-6 text-sm font-semibold text-slate-500">Đang tải máy đến hạn...</div>
          ) : (
            <div className="grid gap-0 xl:grid-cols-2 xl:divide-x xl:divide-slate-100">
              <div className="p-4 sm:p-5">
                <h3 className="mb-3 font-black text-red-700">CẦN XỬ LÝ NGAY</h3>
                <div className="space-y-3">
                  {dueNow.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">{item.machineId}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.machine.model} · {item.machine.customer?.name || "Chưa có khách hàng"}</p>
                          {item.machine.customer?.phone && <p className="mt-1 text-sm font-bold text-slate-700">SĐT: {item.machine.customer.phone}</p>}
                        </div>
                        <span className="status-pill status-rose">{formatDate(item.dueDate)}</span>
                      </div>
                      <p className="mt-3 font-bold text-red-800">{item.title}</p>
                    </article>
                  ))}
                  {dueNow.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">Hiện chưa có máy đến hạn thay lõi.</p>}
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <h3 className="mb-3 font-black text-amber-700">SẮP ĐẾN HẠN TRONG 7 NGÀY</h3>
                <div className="space-y-3">
                  {upcoming.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">{item.machineId}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.machine.model} · {item.machine.customer?.name || "Chưa có khách hàng"}</p>
                          {item.machine.customer?.phone && <p className="mt-1 text-sm font-bold text-slate-700">SĐT: {item.machine.customer.phone}</p>}
                        </div>
                        <span className="status-pill status-slate">{formatDate(item.dueDate)}</span>
                      </div>
                      <p className="mt-3 font-bold text-amber-800">{item.title}</p>
                    </article>
                  ))}
                  {upcoming.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">Không có máy sắp đến hạn trong 7 ngày tới.</p>}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="surface-card p-5 sm:p-6">
          <p className="eyebrow">KOSOVOTA · Định mức bảo trì</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">4 bảng lịch nhắc thay lõi theo dòng máy</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Mỗi model dùng đúng cấu hình vật tư và chu kỳ riêng. Lịch thực tế của từng máy được tính từ ngày lắp đặt.
          </p>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          {plans.map((product, planIndex) => product && (
            <article key={product.modelCode} className="surface-card overflow-hidden">
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Bảng {planIndex + 1}</p>
                    <h2 className="mt-1 text-lg font-black text-slate-950">{product.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">Model: <strong>{product.modelCode}</strong></p>
                  </div>
                  <span className="status-pill status-slate">{product.category}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-slate-800 text-left text-white">
                    <tr>
                      <th className="p-3">STT</th>
                      <th className="p-3">Mốc</th>
                      <th className="p-3">Nội dung / vật tư</th>
                      <th className="p-3">Loại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {product.maintenancePlan.map((item, index) => (
                      <tr key={`${product.modelCode}-${index}`}>
                        <td className="p-3 font-bold">{index + 1}</td>
                        <td className="p-3 font-semibold text-slate-700">{intervalLabel(item)}</td>
                        <td className="p-3 font-bold text-slate-950">{item.title}</td>
                        <td className="p-3">
                          <span className={item.customerCare ? "status-pill status-slate" : "status-pill status-emerald"}>
                            {item.customerCare ? "Chăm sóc" : "Thay lõi / bảo trì"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
