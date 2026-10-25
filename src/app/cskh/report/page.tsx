"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { CARE_RESULT_OPTIONS, SERVICE_WORK_OPTIONS } from "@/lib/cskh-report";
import { readApiResponse } from "@/lib/client-api";

type ReportRow = {
  id: string;
  serviceOrderId: string | null;
  orderCode: string;
  date: string | null;
  machineId: string;
  machineCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastCustomerStatus: string;
  ownerName: string;
  province: string;
  ward: string;
  street: string;
  cskhName: string;
  activationDealerCode: string;
  activationDate: string | null;
  lastCareDate: string | null;
  lastCareWork: string;
  monthsSinceActivation: number | null;
  nextCareTitle: string;
  nextCareDate: string | null;
  currentCareResult: string;
  dealerId: string | null;
  dealerCode: string;
  dealerName: string;
  serviceResult: string;
  serviceType: string;
  status: string;
  reportCount: number;
  updatedAt: string;
};

type ReportData = {
  rows: ReportRow[];
  metrics: { total: number; due: number; cared: number; serviced: number; assigned: number };
  generatedAt: string;
};

type Dealer = {
  id: string;
  dealerCode: string;
  name: string;
  phone: string;
  services?: string | null;
  distanceKm?: number;
  rank?: number;
  capabilityMatched?: boolean;
};

type Filter = "all" | "due" | "uncared" | "unassigned" | "serviced";

const HEADERS = [
  "STT", "Ngày", "Mã máy", "Mã KH", "Khách hàng", "Điện thoại", "Trạng thái KH", "Chủ sở hữu",
  "Tỉnh/TP", "Xã/phường", "Địa chỉ", "NV CSKH", "Đại lý kích hoạt", "Ngày kích hoạt", "CS gần nhất",
  "Công việc gần nhất", "Tháng sử dụng", "Kỳ chăm sóc tiếp theo", "Kết quả chăm sóc", "Tìm đại lý",
  "Đại lý nhận DV", "Kết quả dịch vụ",
] as const;

const WIDTHS = [64, 105, 130, 145, 190, 135, 190, 155, 145, 145, 230, 170, 145, 125, 130, 190, 125, 230, 210, 135, 175, 220];

function date(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function isoDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function isDue(row: ReportRow, today = new Date().toISOString().slice(0, 10)) {
  return Boolean(row.date && isoDate(row.date) <= today && !["COMPLETED", "CANCELLED"].includes(row.status));
}

function dealerSearchAllowed(row: ReportRow) {
  return Boolean(row.serviceOrderId)
    && (["KH tiếp nhận CS + dịch vụ", "KH khó liên lạc - Dịch vụ"].includes(row.currentCareResult) || Boolean(row.dealerId));
}

export default function CskhReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [dealerOrder, setDealerOrder] = useState<ReportRow | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [dealerLoading, setDealerLoading] = useState(false);
  const preparedDueOrders = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/cskh/report", { cache: "no-store" });
      const result = await readApiResponse<ReportData>(response);
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "Không tải được dữ liệu CSKH từ hệ thống.");
      }
      setData(result.data);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được dữ liệu CSKH." });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (preparedDueOrders.current) return;
    preparedDueOrders.current = true;
    let cancelled = false;

    const prepare = async () => {
      try {
        await fetch("/api/maintenance-schedules/sync-missing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 1000 }),
        });
        await fetch(`/api/maintenance-schedules/generate-orders?through=${encodeURIComponent(new Date().toISOString())}`, {
          method: "POST",
        });
      } catch {
        // Báo cáo vẫn đọc trực tiếp máy đã kích hoạt nếu tác vụ tự động không chạy được.
      }
      if (!cancelled) await load(true);
    };

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return (data?.rows || []).filter((row) => {
      const haystack = [
        row.machineCode, row.machineId, row.customerId, row.customerName, row.customerPhone,
        row.province, row.ward, row.street, row.dealerCode, row.dealerName, row.orderCode,
      ].join(" ").toLowerCase();
      if (keyword && !haystack.includes(keyword)) return false;
      if (filter === "due") return isDue(row, today);
      if (filter === "uncared") return isDue(row, today) && !row.currentCareResult;
      if (filter === "unassigned") return Boolean(row.serviceOrderId) && dealerSearchAllowed(row) && !row.dealerCode;
      if (filter === "serviced") return row.reportCount > 0 || row.status === "COMPLETED";
      return true;
    });
  }, [data, filter, query]);

  async function updateServiceType(row: ReportRow, serviceType: string) {
    if (!row.serviceOrderId) {
      setNotice({ kind: "info", text: `${row.machineCode} chưa có lệnh dịch vụ. Khi đến kỳ, hệ thống sẽ tự sinh lệnh để CSKH thao tác.` });
      return;
    }
    const orderId = row.serviceOrderId;
    setBusyId(row.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/service-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceType }),
      });
      const result = await readApiResponse<unknown>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được công việc.");
      setNotice({ kind: "success", text: `Đã cập nhật công việc cho ${row.machineCode}.` });
      await load(true);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được công việc." });
    } finally {
      setBusyId(null);
    }
  }

  async function updateCareResult(row: ReportRow, label: string) {
    if (!row.serviceOrderId) {
      setNotice({ kind: "info", text: `${row.machineCode} chưa có lệnh đến kỳ nên chưa thể chốt kết quả chăm sóc.` });
      return;
    }
    const option = CARE_RESULT_OPTIONS.find((item) => item.label === label);
    if (!option) return;
    const orderId = row.serviceOrderId;
    setBusyId(row.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/service-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: option.status }),
      });
      const result = await readApiResponse<unknown>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được kết quả chăm sóc.");

      const historyResponse = await fetch(`/api/cskh/report/${orderId}/care-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const history = await readApiResponse<unknown>(historyResponse);
      if (!historyResponse.ok || !history.success) throw new Error(history.message || "Chưa ghi được lịch sử chăm sóc.");
      setNotice({ kind: "success", text: `Đã lưu kết quả chăm sóc cho ${row.machineCode}.` });
      await load(true);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được kết quả chăm sóc." });
      await load(true);
    } finally {
      setBusyId(null);
    }
  }

  async function findDealers(row: ReportRow) {
    if (!row.serviceOrderId) {
      setNotice({ kind: "info", text: `${row.machineCode} chưa có lệnh dịch vụ. Chưa cần tìm đại lý ở thời điểm này.` });
      return;
    }
    if (!dealerSearchAllowed(row)) {
      setNotice({ kind: "info", text: "Cập nhật kết quả chăm sóc trước khi tìm đại lý." });
      return;
    }
    setDealerOrder(row);
    setDealers([]);
    setDealerLoading(true);
    try {
      const response = await fetch("/api/dealers/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId: row.machineId, serviceType: row.serviceType, limit: 10 }),
      });
      const result = await readApiResponse<Dealer[]>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không tìm được đại lý phù hợp.");
      setDealers(result.data || []);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tìm được đại lý phù hợp." });
      setDealerOrder(null);
    } finally {
      setDealerLoading(false);
    }
  }

  async function assignDealer(dealer: Dealer) {
    if (!dealerOrder?.serviceOrderId) return;
    setBusyId(dealerOrder.id);
    try {
      const response = await fetch("/api/service-orders/assign-dealer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: dealerOrder.serviceOrderId, dealerId: dealer.id }),
      });
      const result = await readApiResponse<unknown>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không giao được lệnh cho đại lý.");
      setNotice({ kind: "success", text: `Đã chọn ${dealer.dealerCode} · ${dealer.name}.` });
      setDealerOrder(null);
      setDealers([]);
      await load(true);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không giao được lệnh cho đại lý." });
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    const body = rows.map((row, index) => [
      index + 1, date(row.date), row.machineCode, row.customerId, row.customerName, row.customerPhone,
      row.lastCustomerStatus, row.ownerName, row.province, row.ward, row.street, row.cskhName,
      row.activationDealerCode, date(row.activationDate), date(row.lastCareDate), row.lastCareWork,
      row.monthsSinceActivation ?? "", [row.serviceType, date(row.nextCareDate)].filter(Boolean).join(" · "),
      row.currentCareResult, row.serviceOrderId ? "Tìm đại lý" : "Chưa có lệnh", row.dealerCode, row.serviceResult,
    ]);
    const csv = `\uFEFF${[HEADERS, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bao-cao-cskh-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const metrics = data?.metrics || { total: 0, due: 0, cared: 0, serviced: 0, assigned: 0 };

  return (
    <main className="min-h-screen bg-slate-50">
      <OperationsHeader
        title="Báo cáo chăm sóc khách hàng"
        subtitle="Dữ liệu máy đã kích hoạt, lịch chăm sóc và dịch vụ cập nhật trực tiếp từ hệ thống"
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="btn-secondary"><Icon name="refresh" size={16}/>Tải lại</button>
            <button type="button" onClick={exportCsv} className="btn-primary px-4 py-2 font-black text-white"><Icon name="file" size={16}/>Xuất CSV</button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1900px] space-y-4 p-3 sm:p-5">
        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Tổng máy theo dõi" value={metrics.total} active={filter === "all"} onClick={() => setFilter("all")}/>
          <Metric label="Đến kỳ chăm sóc" value={metrics.due} active={filter === "due"} onClick={() => setFilter("due")}/>
          <Metric label="Đã chăm sóc" value={metrics.cared} onClick={() => setFilter("all")}/>
          <Metric label="Đã giao đại lý" value={metrics.assigned} active={filter === "unassigned"} onClick={() => setFilter("unassigned")}/>
          <Metric label="Đã thực hiện dịch vụ" value={metrics.serviced} active={filter === "serviced"} onClick={() => setFilter("serviced")}/>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_auto] lg:items-center">
            <label className="relative">
              <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm máy, khách hàng, SĐT, địa chỉ, đại lý..." className="pl-11"/>
            </label>
            <div className="flex gap-2 overflow-x-auto">
              {([['all','Tất cả'],['due','Đến kỳ'],['uncared','Chưa chăm sóc'],['unassigned','Chưa có đại lý'],['serviced','Đã hoàn tất']] as Array<[Filter,string]>).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-extrabold transition ${filter === value ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
            <span>Hiển thị <strong className="text-slate-800">{rows.length}</strong> / {data?.rows.length || 0} dòng</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500"/>Đồng bộ hệ thống · {dateTime(data?.generatedAt)}</span>
          </div>
        </section>

        {loading && !data ? (
          <LoadingState label="Đang tải dữ liệu CSKH..."/>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-extrabold text-slate-900">Danh sách chăm sóc khách hàng</h2>
              <p className="mt-0.5 text-xs text-slate-500">Máy đã kích hoạt xuất hiện ngay. Các thao tác CSKH được mở khi máy có lệnh đến kỳ.</p>
            </div>
            <div className="max-h-[70vh] overflow-auto overscroll-contain">
              <table className="w-full min-w-[3500px] border-separate border-spacing-0 text-[12px] text-slate-700">
                <colgroup>{HEADERS.map((_, index) => <col key={index} style={{ width: WIDTHS[index] }}/>)}</colgroup>
                <thead className="sticky top-0 z-20">
                  <tr>{HEADERS.map((header, index) => <th key={header} className={`border-b border-r border-slate-200 bg-slate-900 px-3 py-3 text-left text-[11px] font-black uppercase tracking-wide text-white ${index === 0 ? "sticky left-0 z-30" : ""}`}>{header}</th>)}</tr>
                </thead>
                <tbody>
                  {!rows.length ? (
                    <tr><td colSpan={22} className="p-12 text-center"><div className="mx-auto max-w-md"><p className="font-extrabold text-slate-700">Chưa có máy đã kích hoạt phù hợp</p><p className="mt-1 text-sm text-slate-500">Kiểm tra máy đã hoàn tất kích hoạt bước 2, có ngày lắp đặt, khách hàng và tỉnh/địa chỉ thuộc phạm vi CSKH.</p></div></td></tr>
                  ) : rows.map((row, index) => {
                    const hasOrder = Boolean(row.serviceOrderId);
                    const completed = row.reportCount > 0 || row.status === "COMPLETED";
                    return (
                      <tr key={row.id} className="group odd:bg-white even:bg-slate-50/60 hover:bg-emerald-50">
                        <Cell sticky center strong>{index + 1}</Cell>
                        <Cell>{date(row.date) || "—"}</Cell>
                        <Cell strong>{row.machineCode}</Cell>
                        <Cell>{row.customerId || "—"}</Cell>
                        <Cell strong>{row.customerName || "—"}</Cell>
                        <Cell><a href={`tel:${row.customerPhone}`} className="font-bold text-sky-700 hover:underline">{row.customerPhone || "—"}</a></Cell>
                        <Cell>{row.lastCustomerStatus || "—"}</Cell>
                        <Cell>{row.ownerName || "—"}</Cell>
                        <Cell>{row.province || "—"}</Cell>
                        <Cell>{row.ward || "—"}</Cell>
                        <Cell>{row.street || "—"}</Cell>
                        <Cell>{row.cskhName || "—"}</Cell>
                        <Cell strong>{row.activationDealerCode || "—"}</Cell>
                        <Cell>{date(row.activationDate) || "—"}</Cell>
                        <Cell>{date(row.lastCareDate) || "—"}</Cell>
                        <Cell>{row.lastCareWork || "—"}</Cell>
                        <Cell center>{row.monthsSinceActivation == null ? "—" : `${row.monthsSinceActivation} tháng`}</Cell>
                        <Cell>
                          <select
                            value={SERVICE_WORK_OPTIONS.includes(row.serviceType as (typeof SERVICE_WORK_OPTIONS)[number]) ? row.serviceType : "__custom"}
                            disabled={busyId === row.id || !hasOrder}
                            onChange={(event) => { if (event.target.value !== "__custom") void updateServiceType(row, event.target.value); }}
                            className="min-w-[200px] rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                          >
                            <option value="__custom">{row.serviceType || row.nextCareTitle || "Chưa có công việc"}</option>
                            {SERVICE_WORK_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <p className="mt-1 text-[11px] text-slate-400">{date(row.nextCareDate) || "Chưa có ngày"}{!hasOrder ? " · chưa sinh lệnh" : ""}</p>
                        </Cell>
                        <Cell>
                          <select
                            value={CARE_RESULT_OPTIONS.some((item) => item.label === row.currentCareResult) ? row.currentCareResult : ""}
                            disabled={busyId === row.id || !hasOrder}
                            onChange={(event) => event.target.value && void updateCareResult(row, event.target.value)}
                            className="min-w-[190px] rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                          >
                            <option value="">{hasOrder ? "Chọn kết quả..." : "Chưa đến bước CSKH"}</option>
                            {CARE_RESULT_OPTIONS.map((item) => <option key={item.status} value={item.label}>{item.label}</option>)}
                          </select>
                        </Cell>
                        <Cell center>
                          <button
                            type="button"
                            disabled={busyId === row.id || !dealerSearchAllowed(row)}
                            onClick={() => void findDealers(row)}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {!hasOrder ? "Chưa tới kỳ" : row.dealerCode ? "Đổi đại lý" : "Tìm đại lý"}
                          </button>
                        </Cell>
                        <Cell><strong className="text-slate-900">{row.dealerCode || "—"}</strong>{row.dealerName && <p className="mt-1 text-[11px] text-slate-500">{row.dealerName}</p>}</Cell>
                        <Cell>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${completed ? "bg-emerald-50 text-emerald-700" : hasOrder ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{row.serviceResult || "Chưa có kết quả"}</span>
                        </Cell>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {dealerOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) setDealerOrder(null); }}>
          <div className="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Gợi ý đại lý phù hợp</p><h2 className="mt-1 text-xl font-black">Top 10 đại lý gần máy</h2><p className="mt-1 text-sm text-slate-500">{dealerOrder.machineCode} · {dealerOrder.serviceType}</p></div>
              <button type="button" onClick={() => setDealerOrder(null)} className="btn-secondary">Đóng</button>
            </div>
            <div className="max-h-[72vh] overflow-auto p-4">
              {dealerLoading ? <LoadingState label="Đang tìm đại lý..."/> : !dealers.length ? <Notice kind="warning">Không có đại lý phù hợp hoặc máy chưa có tọa độ.</Notice> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-sm">
                    <thead><tr className="bg-slate-900 text-white">{["#", "Mã đại lý", "Tên đại lý", "Điện thoại", "Khoảng cách", "Năng lực", "Thao tác"].map((header) => <th key={header} className="p-3 text-left text-xs font-black uppercase">{header}</th>)}</tr></thead>
                    <tbody>{dealers.map((dealer, index) => <tr key={dealer.id} className="border-b border-slate-100"><td className="p-3 font-bold">{dealer.rank ?? index + 1}</td><td className="p-3 font-black">{dealer.dealerCode}</td><td className="p-3">{dealer.name}</td><td className="p-3"><a href={`tel:${dealer.phone}`} className="font-bold text-sky-700">{dealer.phone}</a></td><td className="p-3 font-bold">{dealer.distanceKm == null ? "—" : `${dealer.distanceKm} km`}</td><td className="p-3">{dealer.services || "Chưa cập nhật"}</td><td className="p-3"><button type="button" disabled={busyId === dealerOrder.id} onClick={() => void assignDealer(dealer)} className="rounded-lg bg-emerald-600 px-4 py-2 font-black text-white">Chọn</button></td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, onClick, active = false }: { label: string; value: number; onClick: () => void; active?: boolean }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"}`}><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></button>;
}

function Cell({ children, center = false, strong = false, sticky = false }: { children: ReactNode; center?: boolean; strong?: boolean; sticky?: boolean }) {
  return <td className={`border-b border-r border-slate-100 px-3 py-3 align-top leading-5 ${center ? "text-center" : ""} ${strong ? "font-bold text-slate-900" : ""} ${sticky ? "sticky left-0 z-10 bg-inherit" : ""}`}>{children}</td>;
}
