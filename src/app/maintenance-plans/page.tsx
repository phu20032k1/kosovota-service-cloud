"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";

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

type PlanItem = {
  title: string;
  monthsAfterInstallation?: number;
  daysAfterInstallation?: number;
  customerCare?: boolean;
};

type PlanConfig = {
  modelCode: string;
  name: string;
  category: string;
  items: PlanItem[];
  source: "default" | "custom";
  updatedAt?: string | null;
};

function intervalLabel(item: PlanItem) {
  if (item.daysAfterInstallation) return `${item.daysAfterInstallation} ngày sau lắp đặt`;
  if (item.monthsAfterInstallation) return `${item.monthsAfterInstallation} tháng sau lắp đặt`;
  return "Theo cấu hình";
}

function dateOnly(value: string | Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function isReplacementTask(title: string) {
  return /thay|lõi|loi|màng|mang|vật liệu|vat lieu|bảo trì|bao tri/i.test(title);
}

function cloneItems(items: PlanItem[]) {
  return items.map((item) => ({ ...item }));
}

export default function MaintenancePlansPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [generatingOrders, setGeneratingOrders] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [editingModel, setEditingModel] = useState("");
  const [draftItems, setDraftItems] = useState<PlanItem[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [applyExisting, setApplyExisting] = useState(true);
  const automationRunning = useRef(false);

  const loadSchedules = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const response = await fetch("/api/maintenance-schedules?status=PENDING", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được lịch bảo trì.");
      setSchedules(result.data || []);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được lịch bảo trì.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadPlans = useCallback(async (silent = false) => {
    if (!silent) setPlansLoading(true);
    try {
      const response = await fetch("/api/maintenance-plan-config", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được cấu hình chu kỳ.");
      setPlans(result.data || []);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được cấu hình chu kỳ.");
    } finally {
      if (!silent) setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadSchedules(), loadPlans()]);

    const refresh = () => {
      if (document.visibilityState === "visible") {
        void loadSchedules(true);
        void loadPlans(true);
      }
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadPlans, loadSchedules]);

  useEffect(() => {
    let cancelled = false;
    const runAutomation = async () => {
      if (automationRunning.current || document.visibilityState !== "visible") return;
      automationRunning.current = true;
      try {
        const syncResponse = await fetch("/api/maintenance-schedules/sync-missing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 1_000 }),
        });
        const syncResult = await syncResponse.json();
        if (!syncResponse.ok || !syncResult.success) throw new Error(syncResult.message || "Không tự sinh được lịch còn thiếu.");

        const orderResponse = await fetch(`/api/maintenance-schedules/generate-orders?through=${encodeURIComponent(new Date().toISOString())}`, {
          method: "POST",
        });
        const orderResult = await orderResponse.json();
        if (!orderResponse.ok || !orderResult.success) throw new Error(orderResult.message || "Không tự sinh được lệnh đến hạn.");

        if (!cancelled && ((syncResult.data?.createdSchedules || 0) > 0 || (orderResult.created || 0) > 0)) {
          setNotice(`Tự động: sinh ${syncResult.data?.createdSchedules || 0} lịch và ${orderResult.created || 0} lệnh đến hạn.`);
        }
        if (!cancelled) await loadSchedules(true);
      } catch (value) {
        if (!cancelled) setError(value instanceof Error ? value.message : "Không chạy được tự động hóa lịch.");
      } finally {
        automationRunning.current = false;
      }
    };

    void runAutomation();
    const timer = window.setInterval(() => void runAutomation(), 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadSchedules]);

  async function syncMissingSchedules() {
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/maintenance-schedules/sync-missing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 1_000 }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không đồng bộ được lịch.");
      setNotice(result.message);
      await loadSchedules(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không đồng bộ được lịch.");
    } finally {
      setSyncing(false);
    }
  }

  async function generateDueOrders() {
    setGeneratingOrders(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/maintenance-schedules/generate-orders?through=${encodeURIComponent(new Date().toISOString())}`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không sinh được lệnh đến hạn.");
      setNotice(result.message);
      await loadSchedules(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không sinh được lệnh đến hạn.");
    } finally {
      setGeneratingOrders(false);
    }
  }

  async function saveDueDate(schedule: Schedule, dueDate: string) {
    setSavingId(schedule.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/maintenance-schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: `${dueDate}T12:00:00+07:00` }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không đổi được hạn.");
      setNotice(`Đã đổi hạn ${schedule.machineId} – ${schedule.title}.`);
      await loadSchedules(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không đổi được hạn.");
    } finally {
      setSavingId("");
    }
  }

  function startEdit(plan: PlanConfig) {
    setEditingModel(plan.modelCode);
    setDraftItems(cloneItems(plan.items));
    setApplyExisting(true);
    setError("");
    setNotice("");
    window.setTimeout(() => document.getElementById("maintenance-plan-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function updateDraft(index: number, patch: Partial<PlanItem>) {
    setDraftItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function changeUnit(index: number, unit: "days" | "months") {
    setDraftItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const currentValue = item.daysAfterInstallation || item.monthsAfterInstallation || 1;
      return unit === "days"
        ? { title: item.title, customerCare: item.customerCare, daysAfterInstallation: currentValue }
        : { title: item.title, customerCare: item.customerCare, monthsAfterInstallation: currentValue };
    }));
  }

  function addMilestone() {
    setDraftItems((current) => [...current, {
      title: "Kiểm tra / bảo trì định kỳ",
      monthsAfterInstallation: 1,
      customerCare: false,
    }]);
  }

  async function savePlan() {
    if (!editingModel || savingPlan) return;
    setSavingPlan(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/maintenance-plan-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelCode: editingModel, items: draftItems, applyExisting }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không lưu được chu kỳ.");
      setNotice(result.message);
      setEditingModel("");
      setDraftItems([]);
      await Promise.all([loadPlans(true), loadSchedules(true)]);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không lưu được chu kỳ.");
    } finally {
      setSavingPlan(false);
    }
  }

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

  const editingPlan = plans.find((plan) => plan.modelCode === editingModel) || null;

  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader
        title="Lịch thay lõi"
        subtitle="Theo dõi lịch thực tế, tự sinh lệnh và chỉnh chu kỳ chăm sóc theo từng dòng máy"
        actions={<div className="mobile-stack-actions flex flex-wrap gap-2">
          <button type="button" onClick={() => void syncMissingSchedules()} disabled={syncing || generatingOrders} className="btn-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50">
            <Icon name={syncing ? "refresh" : "calendar"} size={17} /> {syncing ? "Đang đồng bộ..." : "Sinh lịch máy bị thiếu"}
          </button>
          <button type="button" onClick={() => void generateDueOrders()} disabled={generatingOrders || syncing} className="btn-secondary px-4 py-2 text-sm font-black disabled:opacity-50">
            <Icon name={generatingOrders ? "refresh" : "activity"} size={17} /> {generatingOrders ? "Đang sinh lệnh..." : "Sinh lệnh đến hạn"}
          </button>
          <button type="button" onClick={() => void Promise.all([loadSchedules(), loadPlans()])} className="icon-button" title="Tải lại lịch">
            <Icon name="refresh" size={18} />
          </button>
        </div>}
      />

      <div className="mx-auto max-w-7xl space-y-5 p-3 sm:p-6">
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</div>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        <section className="surface-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <p className="eyebrow">Theo dõi thực tế</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Máy cần thay lõi / bảo trì</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Quá hạn và hôm nay nằm bên trái; lịch trong 7 ngày tới nằm bên phải. Dữ liệu tự làm mới.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="status-pill status-rose">Đến hạn: {dueNow.length}</span>
              <span className="status-pill status-slate">7 ngày tới: {upcoming.length}</span>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-sm font-semibold text-slate-500">Đang tải máy đến hạn...</div>
          ) : (
            <div className="grid gap-0 xl:grid-cols-2 xl:divide-x xl:divide-slate-100">
              <div className="p-3 sm:p-5">
                <h3 className="mb-3 font-black text-red-700">CẦN XỬ LÝ NGAY</h3>
                <div className="space-y-3">
                  {dueNow.map((item) => <ScheduleCard key={item.id} item={item} tone="due" saving={savingId === item.id} onSave={saveDueDate} />)}
                  {dueNow.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">Hiện chưa có máy đến hạn thay lõi.</p>}
                </div>
              </div>

              <div className="p-3 sm:p-5">
                <h3 className="mb-3 font-black text-amber-700">SẮP ĐẾN HẠN TRONG 7 NGÀY</h3>
                <div className="space-y-3">
                  {upcoming.map((item) => <ScheduleCard key={item.id} item={item} tone="upcoming" saving={savingId === item.id} onSave={saveDueDate} />)}
                  {upcoming.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">Không có máy sắp đến hạn trong 7 ngày tới.</p>}
                </div>
              </div>
            </div>
          )}
        </section>

        {editingPlan && (
          <section id="maintenance-plan-editor" className="surface-card scroll-mt-24 overflow-hidden">
            <div className="data-toolbar">
              <div>
                <p className="section-kicker">Chỉnh chu kỳ</p>
                <h2 className="page-section-title">{editingPlan.name}</h2>
                <p className="page-section-subtitle">Thay đổi này được lưu thành phiên bản cấu hình mới, không mất lịch sử cấu hình cũ.</p>
              </div>
              <button type="button" onClick={() => { setEditingModel(""); setDraftItems([]); }} className="btn-secondary px-4 py-2 text-sm font-black">
                <Icon name="x" size={16}/>Đóng
              </button>
            </div>
            <div className="space-y-3 p-3 sm:p-5">
              {draftItems.map((item, index) => {
                const usesDays = typeof item.daysAfterInstallation === "number";
                const value = item.daysAfterInstallation || item.monthsAfterInstallation || 1;
                return (
                  <article key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_120px_120px_auto_auto] lg:items-end">
                      <label className="min-w-0">
                        <span className="field-label">Nội dung mốc {index + 1}</span>
                        <input value={item.title} onChange={(event) => updateDraft(index, { title: event.target.value })} className="w-full min-w-0" />
                      </label>
                      <label>
                        <span className="field-label">Đơn vị</span>
                        <select value={usesDays ? "days" : "months"} onChange={(event) => changeUnit(index, event.target.value as "days" | "months")} className="w-full">
                          <option value="days">Ngày</option>
                          <option value="months">Tháng</option>
                        </select>
                      </label>
                      <label>
                        <span className="field-label">Sau lắp đặt</span>
                        <input
                          type="number"
                          min={1}
                          max={usesDays ? 3650 : 120}
                          value={value}
                          onChange={(event) => updateDraft(index, usesDays
                            ? { daysAfterInstallation: Math.max(1, Number(event.target.value) || 1) }
                            : { monthsAfterInstallation: Math.max(1, Number(event.target.value) || 1) })}
                          className="w-full"
                        />
                      </label>
                      <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                        <input type="checkbox" checked={Boolean(item.customerCare)} onChange={(event) => updateDraft(index, { customerCare: event.target.checked })} />
                        Chăm sóc
                      </label>
                      <button type="button" disabled={draftItems.length <= 1} onClick={() => setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="ghost-danger disabled:opacity-40">
                        <Icon name="trash" size={16}/>Bỏ
                      </button>
                    </div>
                  </article>
                );
              })}
              <button type="button" onClick={addMilestone} className="btn-secondary w-full px-4 py-3 text-sm font-black sm:w-auto">
                <Icon name="plus" size={16}/>Thêm mốc
              </button>
              <label className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                <input type="checkbox" checked={applyExisting} onChange={(event) => setApplyExisting(event.target.checked)} className="mt-1 shrink-0" />
                <span><strong>Áp dụng cho lịch tương lai của máy đang có.</strong> Các lịch đã tạo lệnh hoặc đã xử lý được giữ nguyên; chỉ lịch PENDING trong tương lai được tính lại.</span>
              </label>
              <div className="mobile-stack-actions flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => { setEditingModel(""); setDraftItems([]); }} className="btn-secondary px-5 py-3 font-black">Hủy</button>
                <button type="button" disabled={savingPlan} onClick={() => void savePlan()} className="btn-primary px-5 py-3 font-black text-white disabled:opacity-50">
                  <Icon name={savingPlan ? "refresh" : "check"} size={17}/>{savingPlan ? "Đang lưu..." : "Lưu chu kỳ"}
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="surface-card p-4 sm:p-6">
          <p className="eyebrow">KOSOVOTA · Định mức bảo trì</p>
          <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">Chu kỳ chăm sóc có thể chỉnh trực tiếp</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Máy mới sẽ dùng cấu hình mới nhất. Khi cần, có thể áp dụng cấu hình mới cho các lịch tương lai của máy đang hoạt động.
          </p>
        </section>

        {plansLoading ? <div className="surface-card p-6 text-sm font-semibold text-slate-500">Đang tải cấu hình chu kỳ...</div> : (
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            {plans.map((plan, planIndex) => (
              <article key={plan.modelCode} className="surface-card min-w-0 overflow-hidden">
                <div className="border-b border-slate-100 p-4 sm:p-5">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Bảng {planIndex + 1}</p>
                      <h2 className="mt-1 break-words text-lg font-black text-slate-950">{plan.name}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                        <span>Model: {plan.modelCode}</span>
                        <span className={plan.source === "custom" ? "status-pill status-green" : "status-pill status-slate"}>
                          {plan.source === "custom" ? "Đã tùy chỉnh" : "Mặc định"}
                        </span>
                        {plan.updatedAt && <span>Cập nhật {formatDate(plan.updatedAt)}</span>}
                      </div>
                    </div>
                    <button type="button" onClick={() => startEdit(plan)} className="btn-secondary shrink-0 px-4 py-2 text-sm font-black">
                      <Icon name="settings" size={16}/>Sửa chu kỳ
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {plan.items.map((item, index) => (
                    <div key={`${plan.modelCode}-${index}`} className="grid min-w-0 gap-2 p-4 sm:grid-cols-[42px_170px_minmax(0,1fr)_auto] sm:items-center">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">{index + 1}</span>
                      <p className="text-sm font-bold text-slate-600">{intervalLabel(item)}</p>
                      <p className="min-w-0 break-words text-sm font-black text-slate-950">{item.title}</p>
                      <span className={item.customerCare ? "status-pill status-slate" : "status-pill status-green"}>
                        {item.customerCare ? "Chăm sóc" : "Thay lõi / bảo trì"}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function ScheduleCard({ item, tone, saving, onSave }: {
  item: Schedule;
  tone: "due" | "upcoming";
  saving: boolean;
  onSave: (schedule: Schedule, dueDate: string) => Promise<void>;
}) {
  const [dueDate, setDueDate] = useState(() => new Date(item.dueDate).toISOString().slice(0, 10));
  return (
    <article className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${tone === "due" ? "border-red-200 bg-red-50/60" : "border-amber-200 bg-amber-50/60"}`}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-all font-black text-slate-950">{item.machineId}</p>
          <p className="mt-1 break-words text-sm text-slate-600">{item.machine.model} · {item.machine.customer?.name || "Chưa có khách hàng"}</p>
          {item.machine.customer?.phone && <p className="mt-1 text-sm font-bold text-slate-700">SĐT: {item.machine.customer.phone}</p>}
        </div>
        <span className={`status-pill w-fit ${tone === "due" ? "status-rose" : "status-slate"}`}>{formatDate(item.dueDate)}</span>
      </div>
      <p className={`mt-3 break-words font-bold ${tone === "due" ? "text-red-800" : "text-amber-800"}`}>{item.title}</p>
      <div className="mt-3 grid min-w-0 gap-2 border-t border-black/5 pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="min-w-0 text-xs font-black text-slate-600">
          Điều chỉnh ngày đến hạn
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="form-input mt-1 w-full min-w-0 max-w-full" />
        </label>
        <button type="button" disabled={saving || !dueDate} onClick={() => void onSave(item, dueDate)} className="btn-secondary px-4 py-3 text-sm font-black disabled:opacity-50">
          {saving ? "Đang lưu..." : "Lưu hạn mới"}
        </button>
      </div>
    </article>
  );
}
