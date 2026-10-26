"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type ImportIssue = { row: number; message: string; customerName?: string; phone?: string; serial?: string };
type ImportResult = {
  success: boolean;
  message: string;
  summary?: {
    successCount: number;
    createdCount: number;
    updatedCount: number;
    linkedMachineCount: number;
    gpsUpdatedCount?: number;
    gpsFailedCount?: number;
    lifecycleUpdatedCount?: number;
    errorCount: number;
  };
  errors?: ImportIssue[];
  warnings?: ImportIssue[];
};
type PreviewResult = {
  success: boolean;
  message: string;
  canImport?: boolean;
  summary?: { totalCount: number; validCount: number; errorCount: number; createCount: number; updateCount: number };
  errors?: ImportIssue[];
  rows?: Array<{ row: number; customerName: string; phone: string; serial?: string; action: "CREATE" | "UPDATE" }>;
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadIssues(items: ImportIssue[], filename: string) {
  const rows = [["Dòng", "Tên khách hàng", "Số điện thoại", "Seri / ID máy", "Nguyên nhân"], ...items.map((item) => [item.row, item.customerName || "", item.phone || "", item.serial || "", item.message])];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ImportCustomersButton({ onComplete }: { onComplete?: () => void | Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLoading(true);
    setResult(null);
    setPreview(null);
    setPendingFile(file);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/import-customers/preview", { method: "POST", body });
      const data = await response.json().catch(() => ({ success: false, message: "Máy chủ trả về dữ liệu không hợp lệ." }));
      setPreview(data);
      if (!response.ok || !data.success) setPendingFile(null);
    } catch {
      setPreview({ success: false, message: "Không thể kiểm tra file. Vui lòng kiểm tra kết nối." });
      setPendingFile(null);
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!pendingFile || !preview?.canImport) return;
    setLoading(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", pendingFile);
      const response = await fetch("/api/admin/import-customers", { method: "POST", body });
      const data = await response.json().catch(() => ({ success: false, message: "Máy chủ trả về dữ liệu không hợp lệ." }));
      setResult(data);
      if (data.success) {
        setPendingFile(null);
        setPreview(null);
        if (onComplete) await onComplete();
      }
    } catch {
      setResult({ success: false, message: "Không thể tải file lên. Vui lòng kiểm tra kết nối." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Excel / CSV import</p>
          <h2 className="mt-1 text-lg font-black">Nhập khách hàng hàng loạt</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">Chọn file → Kiểm tra trước → Xác nhận nhập. Bước kiểm tra trước không ghi dữ liệu vào hệ thống.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/templates/mau-nhap-khach-hang.csv" download className="btn-secondary px-4 py-3 text-sm font-black"><Icon name="file" size={17} />TẢI FILE MẪU</a>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="btn-primary px-4 py-3 text-sm font-black text-white disabled:opacity-60"><Icon name="upload" size={17} />{loading ? "Đang xử lý..." : "CHỌN FILE"}</button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900 md:grid-cols-3">
        <span><strong>1.</strong> Chọn file mẫu hoặc file Excel/CSV.</span>
        <span><strong>2.</strong> Kiểm tra trước để xem dòng tạo mới, cập nhật và lỗi.</span>
        <span><strong>3.</strong> Chỉ bấm Xác nhận nhập khi kết quả kiểm tra hợp lệ.</span>
      </div>
      <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.csv" onChange={chooseFile} className="sr-only" />

      {preview && (
        <div className={`mt-4 rounded-2xl border p-4 ${preview.success && preview.canImport ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-wider text-blue-700">Kiểm tra trước</p><strong className="mt-1 block">{preview.message}</strong></div>
            {preview.canImport && pendingFile && <button type="button" onClick={() => void confirmImport()} disabled={loading} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60">{loading ? "Đang nhập..." : "XÁC NHẬN NHẬP"}</button>}
          </div>
          {preview.summary && <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5"><Stat label="Tổng" value={preview.summary.totalCount}/><Stat label="Hợp lệ" value={preview.summary.validCount}/><Stat label="Tạo mới" value={preview.summary.createCount}/><Stat label="Cập nhật" value={preview.summary.updateCount}/><Stat label="Lỗi" value={preview.summary.errorCount}/></div>}
          {!!preview.rows?.length && <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-xs"><thead><tr className="text-slate-500"><th className="p-2">Dòng</th><th className="p-2">Khách hàng</th><th className="p-2">SĐT</th><th className="p-2">Seri</th><th className="p-2">Thao tác</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={`${row.row}-${row.phone}`} className="border-t"><td className="p-2">{row.row}</td><td className="p-2 font-bold">{row.customerName}</td><td className="p-2">{row.phone}</td><td className="p-2">{row.serial || "—"}</td><td className="p-2 font-black">{row.action === "CREATE" ? "Tạo mới" : "Cập nhật"}</td></tr>)}</tbody></table></div>}
          {!!preview.errors?.length && <div className="mt-4 max-h-52 overflow-auto rounded-xl bg-white/70 p-3 text-sm text-rose-800"><strong>Dòng cần sửa:</strong>{preview.errors.map((item) => <p key={`${item.row}-${item.message}`} className="mt-1">Dòng {item.row}: {item.message}</p>)}</div>}
          {pendingFile && <button type="button" onClick={() => { setPendingFile(null); setPreview(null); }} className="mt-3 text-xs font-bold text-slate-500">Hủy file này</button>}
        </div>
      )}

      {result && (
        <div className={`mt-4 rounded-2xl border p-3 text-sm ${result.success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><strong>{result.message}</strong>{!!result.errors?.length && <button type="button" onClick={() => downloadIssues(result.errors || [], "kosovota-loi-nhap-khach-hang.csv")} className="btn-secondary px-3 py-2 text-xs font-black"><Icon name="file" size={15} /> TẢI CSV LỖI ({result.errors.length})</button>}</div>
          {result.summary && <p className="mt-1 leading-6">Thành công: {result.summary.successCount} · Tạo mới: {result.summary.createdCount} · Cập nhật: {result.summary.updatedCount} · Gắn máy: {result.summary.linkedMachineCount} · Lỗi: {result.summary.errorCount}</p>}
          {!!result.errors?.length && <div className="mt-2 max-h-64 overflow-auto rounded-xl bg-white/70 p-2 text-rose-900"><strong>Lỗi dữ liệu:</strong>{result.errors.slice(0, 100).map((error) => <p key={`${error.row}-${error.message}`}>Dòng {error.row}: {error.message}</p>)}</div>}
          {!!result.warnings?.length && <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-900"><strong>Cảnh báo GPS:</strong>{result.warnings.slice(0, 100).map((warning) => <p key={`${warning.row}-${warning.message}`}>Dòng {warning.row}: {warning.message}</p>)}</div>}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-white/80 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="text-xl font-black">{value}</p></div>;
}
