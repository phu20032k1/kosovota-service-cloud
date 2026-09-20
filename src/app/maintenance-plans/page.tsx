"use client";

import Link from "next/link";
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

type Horizon = "ALL" | "7" | "30" | "90";

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

function dayDiff(value: string | Date) {
  const today = dateOnly(new Date()).getTime();
  const due = dateOnly(value).getTime();
  return Math.round((due - today) / 86_400_000);
}

function isReplacementTask(title: string) {
  return /thay|lõi|loi|màng|mang|vật liệu|vat lieu|bảo trì|bao tri/i.test(title);
}

function cloneItems(items: PlanItem[]) {
  return items.map((item) => ({ ...item }));
}

function dueText(value: string) {
  const days = dayDiff(value);
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return "Đến hạn hôm nay";
  if (days === 1) return "Còn 1 ngày";
  return `Còn ${days} ngày`;
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
  const [search, setSearch] = useState("");
  const [horizon, setHorizon] = useState<Horizon>("30");
  const automationRunning = useRef(false);

  const loadSchedules = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const response = await fetch("/api/maintenance-schedules?status=PENDING,ORDER_CREATED", { cache: "no-store" });
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
          setNotice(`Đã tự khôi phục ${syncResult.data?.createdSchedules || 0} lịch thiếu và tạo ${orderResult.created || 0} lệnh đến hạn.`);
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

  const replacementSchedules = useMemo(
    () => schedules.filter((item) => isReplacementTask(item.title)),
    [schedules],
  );

  const stats = useMemo(() => {
    const today = dateOnly(new Date());
    const next7 = new Date(today); next7.setDate(next7.getDate() + 7);
    const next30 = new Date(today); next30.setDate(next30.getDate() + 30);

    return {
      overdue: replacementSchedules.filter((item) => dateOnly(item.dueDate) < today).length,
      today: replacementSchedules.filter((item) => dateOnly(item.dueDate).getTime() === today.getTime()).length,
      next7: replacementSchedules.filter((item) => {
        const due = dateOnly(item.dueDate);
        return due > today && due <= next7;
      }).length,
      next30: replacementSchedules.filter((item) => {
        const due = dateOnly(item.dueDate);
        return due > today && due <= next30;
      }).length,
      orderCreated: replacementSchedules.filter((item) => item.status === "ORDER_CREATED").length,
      total: replacementSchedules.length,
    };
  }, [replacementSchedules]);

  const urgentSchedules = useMemo(
    () => replacementSchedules.filter((item) => dayDiff(item.dueDate) <= 0),
    [replacementSchedules],
  );

  const filteredSchedules = useMemo(() => {
    const key = search.trim().toLowerCase();
    const maxDays = horizon === "ALL" ? Number.POSITIVE_INFINITY : Number(horizon);
    return replacementSchedules.filter((item) => {
      const days = dayDiff(item.dueDate);
      if (days < 1 || days > maxDays) return false;
      if (!key) return true;
      const haystack = [
        item.machineId,
        item.machine.model,
        item.title,
        item.machine.customer?.name,
        item.machine.customer?.phone,
        item.machine.customer?.address,
        item.serviceOrder?.orderCode,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(key);
    });
  }, [horizon, replacementSchedules, search]);

  const editingPlan = plans.find((plan) => plan.modelCode === editingModel) || null;

  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader
        title="Lịch thay lõi"
        subtitle="Theo dõi toàn bộ lịch mở, máy quá hạn, lệnh đã sinh và chu kỳ từng dòng máy"
        actions={<div className="mobile-stack-actions flex flex-wrap gap-2">
          <button type="button" onClick={() => void syncMissingSchedules()} disabled={syncing || generatingOrders} className="btn-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50">
            <Icon name={syncing ? "refresh" : "calendar"} size={17} /> {syncing ? "Đang khôi phục..." : "Khôi phục lịch thiếu"}
          </button>
          <button type="button" onClick={() => void generateDueOrders()} disabled={generatingOrders || syncing} className="btn-secondary px-4 py-2 text-sm font-black disabled:opacity-50">
            <Icon name={generatingOrders ? "refresh" : "activity"} size={17} /> {generatingOrders ? "Đang tạo lệnh..." : "Tạo lệnh đến hạn"}
          </button>
          <button type="button" onClick={() => void Promise.all([loadSchedules(), loadPlans()])} className="icon-button" title="Tải lại lịch">
            <Icon name="refresh" size={18} />
          </button>
        </div>}
      />

      <div className="mx-auto max-w-7xl space-y-5 p-3 sm:p-6">
        {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</div>}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-800 text-white shadow-xl shadow-slate-300/40">
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.14em] text-emerald-100">
                <Icon name="calendar" size={15}/> Quản lý bảo trì
              </div>
              <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">Lịch thay lõi & bảo trì</h1>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:min-w-[600px]">
              <StatTile label="Quá hạn" value={stats.overdue} tone="rose"/>
              <StatTile label="Hôm nay" value={stats.today} tone="amber"/>
              <StatTile label="7 ngày tới" value={stats.next7} tone="blue"/>
              <StatTile label="Đã tạo lệnh" value={stats.orderCreated} tone="emerald"/>
              <StatTile label="Tổng lịch mở" value={stats.total} tone="slate"/>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
          <article className="surface-card overflow-hidden">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow">Ưu tiên xử lý</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Đến hạn và quá hạn</h2>

                </div>
                <span className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700">{urgentSchedules.length} việc cần chú ý</span>
              </div>
            </div>
            {loading ? (
              <LoadingBlock text="Đang tải lịch thay lõi..."/>
            ) : urgentSchedules.length ? (
              <div className="divide-y divide-slate-100">
                {urgentSchedules.map((item) => (
                  <ScheduleRow key={item.id} item={item} saving={savingId === item.id} onSave={saveDueDate} urgent />
                ))}
              </div>
            ) : (
              <EmptyCalendar
                title="Không có lịch quá hạn"
                description={stats.total ? "Các lịch thay lõi hiện tại đều đang ở tương lai." : "Chưa tìm thấy lịch thay lõi. Bấm “Khôi phục lịch thiếu” để hệ thống tạo lại từ ngày lắp đặt."}
                action={!stats.total ? <button type="button" onClick={() => void syncMissingSchedules()} disabled={syncing} className="btn-primary px-4 py-3 text-sm font-black text-white disabled:opacity-50"><Icon name="refresh" size={16}/>Khôi phục lịch ngay</button> : undefined}
              />
            )}
          </article>

          <aside className="surface-card overflow-hidden">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <p className="eyebrow">Tổng quan 30 ngày</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Khối lượng sắp tới</h2>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
              <SummaryBox icon="clock" label="Trong 7 ngày" value={stats.next7} note="Cần chuẩn bị khách hàng và vật tư"/>
              <SummaryBox icon="calendar" label="Trong 30 ngày" value={stats.next30} note="Tổng lịch thay lõi sắp tới"/>
              <SummaryBox icon="activity" label="Đã sinh lệnh" value={stats.orderCreated} note="Có lệnh dịch vụ đang theo dõi"/>
              <SummaryBox icon="wrench" label="Lịch mở toàn bộ" value={stats.total} note="PENDING + ORDER_CREATED"/>
            </div>
          </aside>
        </section>

        <section className="surface-card overflow-hidden">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="eyebrow">Lịch sắp tới</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Danh sách thay lõi theo thời gian</h2>

              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_auto]">
                <label className="relative min-w-0">
                  <Icon name="search" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã máy, khách, SĐT, nội dung..." className="w-full pl-10"/>
                </label>
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
                  {([
                    ["7", "7N"],
                    ["30", "30N"],
                    ["90", "90N"],
                    ["ALL", "Tất cả"],
                  ] as [Horizon, string][]).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setHorizon(value)} className={`rounded-lg px-3 py-2 text-xs font-black transition ${horizon === value ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {loading ? <LoadingBlock text="Đang tải lịch sắp tới..."/> : filteredSchedules.length ? (
            <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] sm:max-h-[680px] lg:max-h-[720px]">
              {filteredSchedules.map((item) => (
                <ScheduleRow key={item.id} item={item} saving={savingId === item.id} onSave={saveDueDate} />
              ))}
            </div>
          ) : (
            <EmptyCalendar
              title={stats.total ? "Không có lịch phù hợp bộ lọc" : "Chưa có lịch thay lõi"}
              description={stats.total ? "Thử đổi khoảng thời gian hoặc từ khóa tìm kiếm." : "Hệ thống sẽ khôi phục lịch từ ngày lắp đặt và đúng chu kỳ của model."}
              action={!stats.total ? <button type="button" onClick={() => void syncMissingSchedules()} disabled={syncing} className="btn-primary px-4 py-3 text-sm font-black text-white disabled:opacity-50"><Icon name="refresh" size={16}/>Khôi phục lịch thiếu</button> : undefined}
            />
          )}
        </section>

        {editingPlan && (
          <section id="maintenance-plan-editor" className="surface-card scroll-mt-24 overflow-hidden">
            <div className="data-toolbar">
              <div>
                <p className="section-kicker">Chỉnh chu kỳ</p>
                <h2 className="page-section-title">{editingPlan.name}</h2>
                <p className="page-section-subtitle">Lưu cấu hình mới và có thể áp dụng ngay cho lịch tương lai của máy hiện có.</p>
              </div>
              <button type="button" onClick={() => { setEditingModel(""); setDraftItems([]); }} className="btn-secondary px-4 py-2 text-sm font-black"><Icon name="x" size={16}/>Đóng</button>
            </div>
            <div className="space-y-3 p-3 sm:p-5">
              {draftItems.map((item, index) => {
                const usesDays = typeof item.daysAfterInstallation === "number";
                const value = item.daysAfterInstallation || item.monthsAfterInstallation || 1;
                return (
                  <article key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_120px_120px_auto_auto] lg:items-end">
                      <label className="min-w-0"><span className="field-label">Nội dung mốc {index + 1}</span><input value={item.title} onChange={(event) => updateDraft(index, { title: event.target.value })} className="w-full min-w-0"/></label>
                      <label><span className="field-label">Đơn vị</span><select value={usesDays ? "days" : "months"} onChange={(event) => changeUnit(index, event.target.value as "days" | "months")} className="w-full"><option value="days">Ngày</option><option value="months">Tháng</option></select></label>
                      <label><span className="field-label">Sau lắp đặt</span><input type="number" min={1} max={usesDays ? 3650 : 120} value={value} onChange={(event) => updateDraft(index, usesDays ? { daysAfterInstallation: Math.max(1, Number(event.target.value) || 1) } : { monthsAfterInstallation: Math.max(1, Number(event.target.value) || 1) })} className="w-full"/></label>
                      <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={Boolean(item.customerCare)} onChange={(event) => updateDraft(index, { customerCare: event.target.checked })}/>Chăm sóc</label>
                      <button type="button" disabled={draftItems.length <= 1} onClick={() => setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="ghost-danger disabled:opacity-40"><Icon name="trash" size={16}/>Bỏ</button>
                    </div>
                  </article>
                );
              })}
              <button type="button" onClick={addMilestone} className="btn-secondary w-full px-4 py-3 text-sm font-black sm:w-auto"><Icon name="plus" size={16}/>Thêm mốc</button>
              <label className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                <input type="checkbox" checked={applyExisting} onChange={(event) => setApplyExisting(event.target.checked)} className="mt-1 shrink-0"/>
                <span><strong>Áp dụng cho lịch tương lai của máy đang có.</strong> Lịch đã sinh lệnh hoặc đã xử lý được giữ nguyên.</span>
              </label>
              <div className="mobile-stack-actions flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => { setEditingModel(""); setDraftItems([]); }} className="btn-secondary px-5 py-3 font-black">Hủy</button>
                <button type="button" disabled={savingPlan} onClick={() => void savePlan()} className="btn-primary px-5 py-3 font-black text-white disabled:opacity-50"><Icon name={savingPlan ? "refresh" : "check"} size={17}/>{savingPlan ? "Đang lưu..." : "Lưu chu kỳ"}</button>
              </div>
            </div>
          </section>
        )}

        <section className="surface-card overflow-hidden">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <p className="eyebrow">Cấu hình chu kỳ</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Chu kỳ theo từng dòng máy</h2>

          </div>

          {plansLoading ? <LoadingBlock text="Đang tải cấu hình chu kỳ..."/> : (
            <div className="grid min-w-0 gap-4 p-3 sm:p-5 xl:grid-cols-2">
              {plans.map((plan) => (
                <article key={plan.modelCode} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex min-w-0 flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">{plan.category}</span>
                        <span className={plan.source === "custom" ? "status-pill status-green" : "status-pill status-slate"}>{plan.source === "custom" ? "Đã tùy chỉnh" : "Mặc định"}</span>
                      </div>
                      <h3 className="mt-2 break-words text-base font-black text-slate-950">{plan.name}</h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">{plan.modelCode}{plan.updatedAt ? ` · cập nhật ${formatDate(plan.updatedAt)}` : ""}</p>
                    </div>
                    <button type="button" onClick={() => startEdit(plan)} className="btn-secondary shrink-0 px-4 py-2 text-sm font-black"><Icon name="settings" size={16}/>Sửa chu kỳ</button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {plan.items.map((item, index) => (
                      <div key={`${plan.modelCode}-${index}`} className="grid min-w-0 gap-2 p-3 sm:grid-cols-[36px_145px_minmax(0,1fr)_auto] sm:items-center sm:p-4">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">{index + 1}</span>
                        <p className="text-xs font-bold text-slate-500 sm:text-sm">{intervalLabel(item)}</p>
                        <p className="min-w-0 break-words text-sm font-black text-slate-950">{item.title}</p>
                        <span className={item.customerCare ? "status-pill status-slate" : "status-pill status-green"}>{item.customerCare ? "Chăm sóc" : "Thay lõi"}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: "rose" | "amber" | "blue" | "emerald" | "slate" }) {
  const classes = {
    rose: "border-rose-300/25 bg-rose-400/10 text-rose-100",
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    blue: "border-sky-300/25 bg-sky-300/10 text-sky-100",
    emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    slate: "border-white/15 bg-white/10 text-white",
  }[tone];
  return <div className={`rounded-2xl border p-3 ${classes}`}><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[11px] font-black uppercase tracking-wide opacity-80">{label}</p></div>;
}

function SummaryBox({ icon, label, value, note }: { icon: "clock" | "calendar" | "activity" | "wrench"; label: string; value: number; note: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><Icon name={icon} size={20}/></span><div className="min-w-0"><div className="flex items-baseline gap-2"><p className="text-2xl font-black text-slate-950">{value}</p><p className="text-sm font-black text-slate-700">{label}</p></div><p className="mt-1 text-xs leading-5 text-slate-500">{note}</p></div></div>;
}

function LoadingBlock({ text }: { text: string }) {
  return <div className="flex items-center justify-center gap-3 p-10 text-sm font-bold text-slate-500"><span className="animate-spin text-emerald-600"><Icon name="refresh" size={20}/></span>{text}</div>;
}

function EmptyCalendar({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="grid min-h-[240px] place-items-center p-6 text-center"><div className="max-w-md"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon name="calendar" size={25}/></span><h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>{action && <div className="mt-4 flex justify-center">{action}</div>}</div></div>;
}

function ScheduleRow({ item, saving, onSave, urgent = false }: {
  item: Schedule;
  saving: boolean;
  onSave: (schedule: Schedule, dueDate: string) => Promise<void>;
  urgent?: boolean;
}) {
  const [dueDate, setDueDate] = useState(() => new Date(item.dueDate).toISOString().slice(0, 10));
  const hasOrder = Boolean(item.serviceOrder);
  const days = dayDiff(item.dueDate);
  const tone = days < 0 ? "rose" : days === 0 ? "amber" : days <= 7 ? "blue" : "slate";
  const toneClasses = {
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  }[tone];

  return (
    <article className={`grid min-w-0 gap-4 p-4 transition hover:bg-slate-50/70 sm:p-5 ${urgent ? "lg:grid-cols-[minmax(0,1fr)_auto]" : "lg:grid-cols-[minmax(0,1fr)_auto]"}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClasses}`}>{dueText(item.dueDate)}</span>
          <span className={hasOrder ? "status-pill status-green" : "status-pill status-slate"}>{hasOrder ? `Đã tạo lệnh ${item.serviceOrder?.orderCode || ""}` : "Chờ xử lý"}</span>
          <span className="text-xs font-bold text-slate-400">{formatDate(item.dueDate)}</span>
        </div>

        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="break-all text-sm font-black text-emerald-700">{item.machineId}</p>
            <h3 className="mt-1 break-words text-base font-black text-slate-950">{item.title}</h3>
            <p className="mt-1 break-words text-sm text-slate-500">{item.machine.model}{item.machine.provinceCode ? ` · tỉnh ${item.machine.provinceCode}` : ""}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            <p className="break-words"><strong className="text-slate-800">Khách:</strong> {item.machine.customer?.name || "Chưa có khách hàng"}</p>
            {item.machine.customer?.phone && <p><strong className="text-slate-800">SĐT:</strong> <a href={`tel:${item.machine.customer.phone}`} className="font-bold text-emerald-700">{item.machine.customer.phone}</a></p>}
            {item.machine.customer?.address && <p className="break-words"><strong className="text-slate-800">Địa chỉ:</strong> {item.machine.customer.address}</p>}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 lg:w-60 lg:justify-center">
        {hasOrder && item.serviceOrder ? (
          <Link href={`/admin/service-orders/${item.serviceOrder.id}`} className="btn-primary w-full px-4 py-3 text-sm font-black text-white"><Icon name="eye" size={16}/>Xem lệnh dịch vụ</Link>
        ) : (
          <>
            <label className="min-w-0"><span className="field-label">Điều chỉnh hạn</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full min-w-0"/></label>
            <button type="button" disabled={saving || !dueDate} onClick={() => void onSave(item, dueDate)} className="btn-secondary w-full px-4 py-3 text-sm font-black disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu ngày mới"}</button>
          </>
        )}
      </div>
    </article>
  );
}
