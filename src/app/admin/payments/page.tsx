"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Dealer = { id: string; dealerCode: string; name: string; bankAccount?: string | null; accountHolder?: string | null; bankName?: string | null };
type Line = { id: string; totalAmount: number; serviceAmount: number; materialAmount: number; serviceOrder: { orderCode: string; serviceType: string; updatedAt: string } };
type Batch = { id: string; batchCode: string; status: string; periodStart: string; periodEnd: string; grossAmount: number; deductions: number; netAmount: number; bankReference?: string | null; createdAt: string; dealer: Dealer; lines: Line[] };
type Order = { id: string; dealerId?: string | null; serviceFee?: number | null; dealer?: Dealer | null };
type Data = { batches: Batch[]; eligibleOrders: Order[]; dealers: Dealer[]; summary: { total: number; paid: number; pending: number } };

const money = (value = 0) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(value));

export default function PaymentsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [form, setForm] = useState({ dealerId: "", periodStart: first, periodEnd: last, note: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payments", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được dữ liệu đối soát.");
      const nextData = result.data as Data;
      setData(nextData);
      if (!form.dealerId && nextData.dealers[0]) setForm((current) => ({ ...current, dealerId: nextData.dealers[0].id }));
      setSelectedId((current) => current && nextData.batches.some((batch) => batch.id === current) ? current : nextData.batches[0]?.id || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu đối soát.");
    } finally {
      setLoading(false);
    }
  }, [form.dealerId]);

  useEffect(() => { void load(); }, [load]);

  const eligible = useMemo(() => data?.eligibleOrders.filter((order) => order.dealerId === form.dealerId).length || 0, [data, form.dealerId]);
  const selectedBatch = useMemo(() => data?.batches.find((batch) => batch.id === selectedId) || null, [data, selectedId]);
  const draftDealer = useMemo(() => data?.dealers.find((dealer) => dealer.id === form.dealerId) || null, [data, form.dealerId]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setError(result.message || "Không tạo được kỳ đối soát.");
      return;
    }
    setMessage(result.message || "Đã tạo kỳ đối soát.");
    setOpen(false);
    await load();
  }

  async function update(id: string, status: string) {
    const bankReference = status === "PAID" ? prompt("Nhập mã giao dịch ngân hàng") || "" : undefined;
    const response = await fetch(`/api/payments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, bankReference }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setError(result.message || "Không cập nhật được kỳ đối soát.");
      return;
    }
    setMessage(result.message || "Đã cập nhật kỳ đối soát.");
    await load();
  }

  return (
    <main className="min-h-screen">
      <OperationsHeader
        title="Đối soát & thanh toán đại lý"
        subtitle="Tập hợp lệnh hoàn thành, duyệt công và theo dõi thanh toán trong một màn hình"
        actions={<button type="button" onClick={load} className="icon-button" title="Tải lại"><Icon name="refresh" size={18}/></button>}
      />

      <div className="page-container space-y-4">
        {message && <Notice kind="success">{message}</Notice>}
        {error && <Notice kind="error">{error}</Notice>}

        {loading && !data ? <LoadingState label="Đang tải dữ liệu đối soát..."/> : data && <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Tổng giá trị đối soát" value={money(data.summary.total)} icon="wallet" tone="violet"/>
            <MetricCard label="Đã thanh toán" value={money(data.summary.paid)} icon="check" tone="emerald"/>
            <MetricCard label="Chờ xử lý" value={money(data.summary.pending)} icon="clock" tone="amber"/>
            <MetricCard label="Lệnh đủ điều kiện" value={data.eligibleOrders.length} icon="file" tone="blue"/>
          </section>

          <section className="surface-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Tổng quan nhanh</p>
              <p className="mt-1 text-sm text-slate-600">Chọn một kỳ bên trái để xem chi tiết lệnh, ngân hàng và thao tác xử lý ngay.</p>
            </div>
            <button type="button" onClick={() => setOpen(true)} className="btn-primary inline-flex items-center gap-2 px-4 py-3 font-black text-white">
              <Icon name="plus" size={17}/>Tạo kỳ đối soát
            </button>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.85fr)]">
            <article className="surface-card overflow-hidden">
              <div className="data-toolbar">
                <div>
                  <h2 className="page-section-title">Danh sách kỳ đối soát</h2>
                  <p className="page-section-subtitle">Mỗi lệnh dịch vụ chỉ xuất hiện trong một kỳ đối soát duy nhất.</p>
                </div>
                <span className="mini-chip"><Icon name="file" size={14}/>{data.batches.length} kỳ hiện có</span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      {['Mã kỳ', 'Đại lý', 'Thời gian', 'Số lệnh', 'Giá trị ròng', 'Trạng thái'].map((header) => (
                        <th key={header} className="p-3 text-left">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.batches.map((batch) => (
                      <tr key={batch.id} onClick={() => setSelectedId(batch.id)} className={`cursor-pointer ${selectedId === batch.id ? 'bg-emerald-50/70' : ''}`}>
                        <td className="p-3 font-black text-slate-950">{batch.batchCode}</td>
                        <td className="p-3">
                          <strong>{batch.dealer.name}</strong>
                          <div className="text-xs text-slate-500">{batch.dealer.dealerCode}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">{date(batch.periodStart)} – {date(batch.periodEnd)}</td>
                        <td className="p-3 font-bold">{batch.lines.length}</td>
                        <td className="p-3 font-black text-emerald-700">{money(batch.netAmount)}</td>
                        <td className="p-3"><StatusBadge value={batch.status}/></td>
                      </tr>
                    ))}
                    {!data.batches.length && <tr><td colSpan={6} className="p-10 text-center text-slate-500">Chưa có kỳ đối soát.</td></tr>}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="surface-card min-h-[320px] p-5 xl:sticky xl:top-28">
              {selectedBatch ? <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Chi tiết kỳ đối soát</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">{selectedBatch.batchCode}</h2>
                    <p className="mt-1 text-sm text-slate-500">{selectedBatch.dealer.dealerCode} · {selectedBatch.dealer.name}</p>
                  </div>
                  <StatusBadge value={selectedBatch.status}/>
                </div>

                <div className="summary-grid mt-4">
                  <Info label="Thời gian" value={`${date(selectedBatch.periodStart)} – ${date(selectedBatch.periodEnd)}`}/>
                  <Info label="Số lệnh" value={`${selectedBatch.lines.length} lệnh`}/>
                  <Info label="Tổng trước trừ" value={money(selectedBatch.grossAmount)}/>
                  <Info label="Giá trị ròng" value={money(selectedBatch.netAmount)}/>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-black text-slate-900">Thông tin thanh toán</p>
                  <div className="mt-2 space-y-1 text-slate-600">
                    <p><strong>Ngân hàng:</strong> {selectedBatch.dealer.bankName || 'Chưa cập nhật'}</p>
                    <p><strong>Chủ tài khoản:</strong> {selectedBatch.dealer.accountHolder || 'Chưa cập nhật'}</p>
                    <p><strong>Số tài khoản:</strong> {selectedBatch.dealer.bankAccount || 'Chưa cập nhật'}</p>
                    <p><strong>Mã giao dịch:</strong> {selectedBatch.bankReference || 'Chưa có'}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedBatch.status === 'SUBMITTED' && <button type="button" onClick={() => update(selectedBatch.id, 'APPROVED')} className="btn-secondary px-3 py-2 text-sm">Duyệt kỳ này</button>}
                  {selectedBatch.status === 'APPROVED' && <button type="button" onClick={() => update(selectedBatch.id, 'PAID')} className="btn-primary px-3 py-2 text-sm font-black text-white">Xác nhận thanh toán</button>}
                  {['SUBMITTED', 'APPROVED'].includes(selectedBatch.status) && <button type="button" onClick={() => update(selectedBatch.id, 'REJECTED')} className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">Từ chối</button>}
                </div>

                <div className="mt-5">
                  <p className="mb-3 text-sm font-black text-slate-900">Lệnh thuộc kỳ này</p>
                  <div className="space-y-2">
                    {selectedBatch.lines.slice(0, 6).map((line) => (
                      <div key={line.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">{line.serviceOrder.orderCode}</p>
                            <p className="mt-1 text-xs text-slate-500">{line.serviceOrder.serviceType}</p>
                          </div>
                          <span className="text-sm font-black text-emerald-700">{money(line.totalAmount)}</span>
                        </div>
                      </div>
                    ))}
                    {!selectedBatch.lines.length && <div className="empty-detail-state"><strong>Không có lệnh nào</strong></div>}
                  </div>
                </div>
              </> : <div className="empty-detail-state h-full"><Icon name="wallet" size={30}/><strong>Chọn một kỳ đối soát</strong><p>Bên trái là danh sách các kỳ để bạn xem nhanh chi tiết và thao tác xử lý.</p></div>}
            </aside>
          </section>
        </>}
      </div>

      {open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
        <form onSubmit={create} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black">Tạo kỳ đối soát</h3>
              <p className="mt-1 text-sm text-slate-500">Hệ thống tự lấy các lệnh hoàn thành chưa thanh toán.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="icon-button"><Icon name="x" size={18}/></button>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Đại lý</span>
              <select value={form.dealerId} onChange={(event) => setForm({ ...form, dealerId: event.target.value })}>
                {data?.dealers.map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.dealerCode} · {dealer.name}</option>)}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-bold">Từ ngày</span>
                <input type="date" value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })}/>
              </label>
              <label>
                <span className="mb-1 block text-sm font-bold">Đến ngày</span>
                <input type="date" value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })}/>
              </label>
            </div>

            <Notice kind="info">
              <div className="space-y-1">
                <p><strong>Đại lý chọn:</strong> {draftDealer ? `${draftDealer.dealerCode} · ${draftDealer.name}` : 'Chưa chọn'}</p>
                <p><strong>Lệnh đủ điều kiện:</strong> {eligible}</p>
              </div>
            </Notice>

            <label className="block">
              <span className="mb-1 block text-sm font-bold">Ghi chú</span>
              <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })}/>
            </label>

            <button className="btn-primary w-full p-3 font-black text-white">Tạo và gửi duyệt</button>
          </div>
        </form>
      </div>}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold leading-5 text-slate-800">{value}</p>
    </div>
  );
}
