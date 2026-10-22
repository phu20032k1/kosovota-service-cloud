"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { CARE_RESULT_OPTIONS, SERVICE_WORK_OPTIONS } from "@/lib/cskh-report";
import { readApiResponse } from "@/lib/client-api";

type ReportRow = {
  id: string;
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
  "STT", "Ngày", "Mã máy", "Mã khách hàng", "Tên khách hàng", "Điện thoại",
  "Trạng thái KH lần gần nhất", "Chủ sở hữu", "Tỉnh/Thành phố", "Xã/phường",
  "Số nhà, tên đường", "NV CSKH sau bán hàng", "Đại lý kích hoạt", "Ngày kích hoạt",
  "Ngày chăm sóc gần nhất", "Công việc chăm sóc gần nhất", "Thời gian từ lúc kích hoạt (tháng)",
  "Kỳ chăm sóc tiếp theo:", "Kết quả chăm sóc lần này", "Nút tìm kiếm đại lý",
  "Đại lý nhận dịch vụ", "Kết quả dịch vụ",
] as const;

const SUBHEADERS = [
  "Số thứ tự", "", "Seri máy", "", "Tên khách hàng", "Điện thoại", "KH tiếp nhận CS + dịch vụ",
  "Tên NVKD", "", "", "", "Tên NV chăm sóc", "", "", "", "Bảng chọn",
  "VD: 18 tháng/36 tháng....", "Bảng chọn theo quy định lịch thay lõi",
  "NVCSKH Cập nhật sau khi gọi điện chăm sóc", "Nhấn nút, sẽ tự hiện bảng kết quả tìm kiếm đại lý",
  "Mã đại lý NV CSKH Cập nhật sau khi xác nhận với đại lý", "Lấy dữ liệu từ đại lý nhập ở sheet 1",
] as const;

const GUIDE = [
  ["B1", "NVCSKH gọi chăm sóc, chốt dịch vụ cần thực hiện"],
  ["B2", "NVCSKH nhấn nút tìm kiếm đại lý => hiện bảng kết quả tra cứu"],
  ["B3", "Đại lý nhận dịch vụ => nhấn chọn đại lý => trả về mã đại lý nhận ở cột \"Đại lý nhận dịch vụ\""],
  ["B4", "Đại lý làm xong dịch vụ => nhập liệu => bảng báo cáo tự động cập nhật trạng thái ở cột \"Kết quả dịch vụ\""],
] as const;

function date(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function isoDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function dealerSearchAllowed(row: ReportRow) {
  return ["KH tiếp nhận CS + dịch vụ", "KH khó liên lạc - Dịch vụ"].includes(row.currentCareResult) || Boolean(row.dealerId);
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

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/cskh/report", { cache: "no-store" });
      const result = await readApiResponse<ReportData>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không tải được báo cáo CSKH.");
      setData(result.data);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được báo cáo CSKH." });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return (data?.rows || []).filter((row) => {
      const haystack = [row.machineCode, row.machineId, row.customerId, row.customerName, row.customerPhone, row.province, row.ward, row.street, row.dealerCode, row.dealerName, row.orderCode].join(" ").toLowerCase();
      if (keyword && !haystack.includes(keyword)) return false;
      if (filter === "due") return Boolean(row.date && isoDate(row.date) <= today && !["COMPLETED", "CANCELLED"].includes(row.status));
      if (filter === "uncared") return !row.currentCareResult;
      if (filter === "unassigned") return dealerSearchAllowed(row) && !row.dealerCode;
      if (filter === "serviced") return row.reportCount > 0 || row.status === "COMPLETED";
      return true;
    });
  }, [data, filter, query]);

  async function updateServiceType(row: ReportRow, serviceType: string) {
    setBusyId(row.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/service-orders/${row.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceType }),
      });
      const result = await readApiResponse<unknown>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được kỳ chăm sóc.");
      setNotice({ kind: "success", text: `Đã chốt công việc “${serviceType}” cho ${row.machineCode}.` });
      await load(true);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được công việc." });
    } finally { setBusyId(null); }
  }

  async function updateCareResult(row: ReportRow, label: string) {
    const option = CARE_RESULT_OPTIONS.find((item) => item.label === label);
    if (!option) return;
    setBusyId(row.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/service-orders/${row.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: option.status }),
      });
      const result = await readApiResponse<unknown>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được kết quả chăm sóc.");

      const historyResponse = await fetch(`/api/cskh/report/${row.id}/care-result`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }),
      });
      const history = await readApiResponse<unknown>(historyResponse);
      if (!historyResponse.ok || !history.success) throw new Error(history.message || "Đã cập nhật lệnh nhưng chưa ghi được lịch sử chăm sóc.");
      setNotice({ kind: "success", text: result.message || `Đã lưu kết quả chăm sóc cho ${row.machineCode}.` });
      await load(true);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được kết quả chăm sóc." });
      await load(true);
    } finally { setBusyId(null); }
  }

  async function findDealers(row: ReportRow) {
    if (!dealerSearchAllowed(row)) {
      setNotice({ kind: "info", text: "Hãy cập nhật “Kết quả chăm sóc lần này” và chốt dịch vụ trước khi tìm đại lý." });
      return;
    }
    setDealerOrder(row);
    setDealers([]);
    setDealerLoading(true);
    try {
      const response = await fetch("/api/dealers/shortlist", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ machineId: row.machineId, serviceType: row.serviceType, limit: 10 }),
      });
      const result = await readApiResponse<Dealer[]>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không tìm được đại lý phù hợp.");
      setDealers(result.data || []);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tìm được đại lý phù hợp." });
      setDealerOrder(null);
    } finally { setDealerLoading(false); }
  }

  async function assignDealer(dealer: Dealer) {
    if (!dealerOrder) return;
    setBusyId(dealerOrder.id);
    try {
      const response = await fetch("/api/service-orders/assign-dealer", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: dealerOrder.id, dealerId: dealer.id }),
      });
      const result = await readApiResponse<unknown>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không giao được lệnh cho đại lý.");
      setNotice({ kind: "success", text: `Đã chọn ${dealer.dealerCode} · ${dealer.name} cho ${dealerOrder.machineCode}.` });
      setDealerOrder(null);
      setDealers([]);
      await load(true);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không giao được lệnh cho đại lý." });
    } finally { setBusyId(null); }
  }

  function exportCsv() {
    const body = rows.map((row, index) => [
      index + 1, date(row.date), row.machineCode, row.customerId, row.customerName, row.customerPhone,
      row.lastCustomerStatus, row.ownerName, row.province, row.ward, row.street, row.cskhName,
      row.activationDealerCode, date(row.activationDate), date(row.lastCareDate), row.lastCareWork,
      row.monthsSinceActivation == null ? "" : row.monthsSinceActivation,
      [row.serviceType, date(row.nextCareDate)].filter(Boolean).join(" · "), row.currentCareResult,
      "Tìm đại lý", row.dealerCode, row.serviceResult,
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

  return <main className="min-h-screen bg-slate-100">
    <OperationsHeader
      title="Bảng báo cáo CSKH hàng ngày"
      subtitle="Bám theo mẫu IIPMAP: chăm sóc → chốt dịch vụ → tìm đại lý → theo dõi kết quả"
      actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} className="btn-secondary"><Icon name="refresh" size={16}/>Tải lại</button><button type="button" onClick={exportCsv} className="btn-primary px-4 py-2 font-black text-white"><Icon name="file" size={16}/>Xuất CSV</button></div>}
    />

    <div className="mx-auto max-w-[1900px] space-y-4 p-3 sm:p-5">
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm" style={{ fontFamily: '"Times New Roman", serif' }}>
        {GUIDE.map(([code, text]) => <div key={code} className="grid border-b border-slate-300 bg-[#d8d8d8] last:border-b-0 sm:grid-cols-[70px_1fr]"><div className="border-b border-slate-300 px-3 py-2 text-center font-bold sm:border-b-0 sm:border-r">{code}</div><div className="px-3 py-2 font-bold">{text}</div></div>)}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Tổng máy trong báo cáo" value={metrics.total} onClick={() => setFilter("all")}/>
        <Metric label="Máy đến kỳ chăm sóc" value={metrics.due} onClick={() => setFilter("due")}/>
        <Metric label="Máy đã chăm sóc" value={metrics.cared} onClick={() => setFilter("all")}/>
        <Metric label="Đã giao đại lý" value={metrics.assigned} onClick={() => setFilter("unassigned")}/>
        <Metric label="Đã thực hiện dịch vụ" value={metrics.serviced} onClick={() => setFilter("serviced")}/>
      </section>

      <section className="surface-card p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
          <label className="relative"><Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm Seri/ID máy, mã KH, tên, SĐT, tỉnh, địa chỉ, mã đại lý..." className="pl-11"/></label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {([['all','Tất cả'],['due','Đến kỳ'],['uncared','Chưa chăm sóc'],['unassigned','Chưa có đại lý'],['serviced','Đã có kết quả DV']] as Array<[Filter,string]>).map(([value,label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${filter === value ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{label}</button>)}
          </div>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">Đang hiển thị {rows.length}/{data?.rows.length || 0} dòng · cập nhật {data ? date(data.generatedAt) : ""}</p>
      </section>

      {loading && !data ? <LoadingState label="Đang lập bảng báo cáo CSKH..."/> : <section className="overflow-hidden rounded-2xl border border-slate-400 bg-white shadow-sm">
        <div className="max-h-[72vh] overflow-auto overscroll-contain">
          <table className="w-full min-w-[3650px] border-collapse text-[13px] text-slate-950" style={{ fontFamily: '"Times New Roman", serif' }}>
            <colgroup>{HEADERS.map((_, index) => <col key={index} style={{ width: [65,105,140,165,190,135,200,160,150,150,230,180,145,125,145,210,185,240,220,155,170,220][index] }}/>)}</colgroup>
            <thead>
              <tr>{HEADERS.map((header) => <th key={header} className="border border-slate-500 bg-[#d8d8d8] px-2 py-3 text-center text-[13px] font-bold leading-5">{header}</th>)}</tr>
              <tr>{SUBHEADERS.map((header, index) => <th key={`${index}-${header}`} className="border border-slate-500 bg-white px-2 py-2 text-center text-[12px] font-normal leading-4">{header}</th>)}</tr>
            </thead>
            <tbody>
              {!rows.length ? <tr><td colSpan={22} className="border border-slate-500 p-8 text-center font-bold text-slate-500">Không có dòng báo cáo phù hợp.</td></tr> : rows.map((row, index) => <tr key={row.id} className="align-top hover:bg-emerald-50/40">
                <Cell center strong>{index + 1}</Cell>
                <Cell>{date(row.date)}</Cell>
                <Cell strong>{row.machineCode}</Cell>
                <Cell>{row.customerId}</Cell>
                <Cell strong>{row.customerName}</Cell>
                <Cell><a href={`tel:${row.customerPhone}`} className="font-bold text-blue-700 underline">{row.customerPhone}</a></Cell>
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
                <Cell><select value={SERVICE_WORK_OPTIONS.includes(row.serviceType as (typeof SERVICE_WORK_OPTIONS)[number]) ? row.serviceType : "__custom"} disabled={busyId === row.id} onChange={(event) => { if (event.target.value !== "__custom") void updateServiceType(row, event.target.value); }} className="min-w-[205px] rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"><option value="__custom">{SERVICE_WORK_OPTIONS.includes(row.serviceType as (typeof SERVICE_WORK_OPTIONS)[number]) ? "Chọn công việc" : row.serviceType || "Chọn công việc"}</option>{SERVICE_WORK_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select><p className="mt-1 text-[11px] text-slate-500">{date(row.nextCareDate) || "Chưa có ngày"}</p></Cell>
                <Cell><select value={CARE_RESULT_OPTIONS.some((item) => item.label === row.currentCareResult) ? row.currentCareResult : ""} disabled={busyId === row.id} onChange={(event) => event.target.value && void updateCareResult(row, event.target.value)} className="min-w-[195px] rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"><option value="">Chọn kết quả...</option>{CARE_RESULT_OPTIONS.map((item) => <option key={item.status} value={item.label}>{item.label}</option>)}</select></Cell>
                <Cell center><button type="button" disabled={busyId === row.id || !dealerSearchAllowed(row)} onClick={() => void findDealers(row)} title={!dealerSearchAllowed(row) ? "Cập nhật kết quả chăm sóc trước" : "Tìm Top 10 đại lý phù hợp"} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{row.dealerCode ? "Đổi đại lý" : "Tìm đại lý"}</button></Cell>
                <Cell><strong>{row.dealerCode || "—"}</strong>{row.dealerName && <p className="mt-1 text-[11px] text-slate-500">{row.dealerName}</p>}</Cell>
                <Cell>{row.serviceResult}</Cell>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>}
    </div>

    {dealerOrder && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) setDealerOrder(null); }}>
      <div className="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b bg-white p-4 sm:p-5"><div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">BẢNG MẪU TRA CỨU ĐẠI LÝ</p><h2 className="mt-1 text-xl font-black">Top 10 đại lý phù hợp nhất</h2><p className="mt-1 text-sm text-slate-500">{dealerOrder.machineCode} · {dealerOrder.serviceType}</p></div><button type="button" onClick={() => setDealerOrder(null)} className="btn-secondary">Đóng</button></div>
        <div className="max-h-[72vh] overflow-auto p-3 sm:p-5">
          {dealerLoading ? <LoadingState label="Đang tính khoảng cách và năng lực đại lý..."/> : !dealers.length ? <Notice kind="warning">Không có đại lý/CTV kỹ thuật phù hợp hoặc máy chưa xác định được GPS.</Notice> : <>
            <div className="mb-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><strong>Mục đích:</strong> Tìm ra đại lý phù hợp nhất để xử lý vấn đề của máy. Danh sách ưu tiên khoảng cách và hiển thị năng lực để NVCSKH xác nhận trước khi chọn.</div>
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-sm" style={{ fontFamily: '"Times New Roman", serif' }}><thead><tr>{["STT","Mã đại lý","Tên đại lý","Số điện thoại:","Khoảng cách đến máy","Các dịch vụ có thể làm được","Nút chọn đại lý"].map((header) => <th key={header} className="border border-slate-500 bg-[#d8d8d8] p-3 text-center font-bold">{header}</th>)}</tr></thead><tbody>{dealers.map((dealer, index) => <tr key={dealer.id}><td className="border border-slate-400 p-3 text-center font-bold">{dealer.rank ?? index + 1}</td><td className="border border-slate-400 p-3 font-bold">{dealer.dealerCode}</td><td className="border border-slate-400 p-3">{dealer.name}</td><td className="border border-slate-400 p-3"><a href={`tel:${dealer.phone}`} className="font-bold text-blue-700 underline">{dealer.phone}</a></td><td className="border border-slate-400 p-3 text-center font-bold">{dealer.distanceKm == null ? "—" : `${dealer.distanceKm} km`}</td><td className="border border-slate-400 p-3">{dealer.services || "Chưa cập nhật"}{dealer.capabilityMatched && <span className="ml-2 rounded bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800">Đúng năng lực</span>}</td><td className="border border-slate-400 p-3 text-center"><button type="button" disabled={busyId === dealerOrder.id} onClick={() => void assignDealer(dealer)} className="rounded-lg bg-emerald-600 px-4 py-2 font-black text-white disabled:opacity-50">CHỌN</button></td></tr>)}</tbody></table></div>
          </>}
        </div>
      </div>
    </div>}
  </main>;
}

function Metric({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="surface-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></button>;
}

function Cell({ children, center = false, strong = false }: { children: React.ReactNode; center?: boolean; strong?: boolean }) {
  return <td className={`border border-slate-400 px-2 py-2 leading-5 ${center ? "text-center" : ""} ${strong ? "font-bold" : ""}`}>{children}</td>;
}
