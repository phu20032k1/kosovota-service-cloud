"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type ImportIssue = { row: number; message: string; customerName?: string; phone?: string; serial?: string };
type Result = {
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

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadIssues(items: ImportIssue[], filename: string) {
  const rows = [
    ["Dòng", "Tên khách hàng", "Số điện thoại", "Seri / ID máy", "Nguyên nhân"],
    ...items.map((item) => [item.row, item.customerName || "", item.phone || "", item.serial || "", item.message]),
  ];
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
  const [result, setResult] = useState<Result | null>(null);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/import-customers", { method: "POST", body });
      const data = await response.json().catch(() => ({ success: false, message: "Máy chủ trả về dữ liệu không hợp lệ." }));
      setResult(data);
      if (data.success && onComplete) await onComplete();
    } catch {
      setResult({ success: false, message: "Không thể tải file lên. Vui lòng kiểm tra kết nối." });
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  return (
    <section className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Excel / CSV import</p>
          <h2 className="mt-1 text-lg font-black">Nhập khách hàng hàng loạt</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Đồng bộ Tên khách hàng, SĐT, địa chỉ, Seri/ID máy, Model, Tên máy, Ngày SX, Ngày lắp,
            kích hoạt bảo hành, thời hạn bảo hành và GPS. Dòng lỗi được giữ riêng để không rollback các dòng hợp lệ.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/templates/mau-nhap-khach-hang.csv" download className="btn-secondary px-4 py-3 text-sm font-black">
            <Icon name="file" size={17} />TẢI FILE MẪU
          </a>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="btn-primary px-4 py-3 text-sm font-black text-white disabled:opacity-60">
            <Icon name="upload" size={17} />{loading ? "Đang nhập..." : "CHỌN FILE KHÁCH HÀNG"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900 md:grid-cols-3">
        <span><strong>1.</strong> Tải file mẫu CSV hoặc dùng file Excel hiện có.</span>
        <span><strong>2.</strong> Không đổi tên các cột chính; để trống cột chưa có dữ liệu.</span>
        <span><strong>3.</strong> Hỗ trợ .xlsx, .xlsm, .csv; lỗi chỉ rõ dòng/KH/SĐT/Seri.</span>
      </div>

      <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.csv" onChange={upload} className="sr-only" />

      {result && (
        <div className={`mt-4 rounded-2xl border p-3 text-sm ${result.success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong>{result.message}</strong>
            {!!result.errors?.length && (
              <button type="button" onClick={() => downloadIssues(result.errors || [], "kosovota-loi-nhap-khach-hang.csv")} className="btn-secondary px-3 py-2 text-xs font-black">
                <Icon name="file" size={15} /> TẢI CSV LỖI ({result.errors.length})
              </button>
            )}
          </div>
          {result.summary && (
            <p className="mt-1 leading-6">
              Thành công: {result.summary.successCount} · Tạo mới: {result.summary.createdCount} · Cập nhật: {result.summary.updatedCount}
              {' · '}Gắn máy: {result.summary.linkedMachineCount}
              {typeof result.summary.gpsUpdatedCount === "number" ? ` · GPS đã ghim: ${result.summary.gpsUpdatedCount}` : ""}
              {typeof result.summary.gpsFailedCount === "number" ? ` · GPS cần kiểm tra: ${result.summary.gpsFailedCount}` : ""}
              {typeof result.summary.lifecycleUpdatedCount === "number" ? ` · Vòng đời/BH: ${result.summary.lifecycleUpdatedCount}` : ""}
              {` · Lỗi: ${result.summary.errorCount}`}
            </p>
          )}
          {!!result.errors?.length && (
            <div className="mt-2 max-h-64 overflow-auto rounded-xl bg-white/70 p-2 text-rose-900">
              <strong>Lỗi dữ liệu:</strong>
              {result.errors.slice(0, 100).map((error) => (
                <p key={`${error.row}-${error.message}`}>
                  Dòng {error.row} · {error.customerName || "Chưa có tên"} · {error.phone || "Chưa có SĐT"} · {error.serial || "Không có Seri"}: {error.message}
                </p>
              ))}
            </div>
          )}
          {!!result.warnings?.length && (
            <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-900">
              <strong>Cảnh báo GPS:</strong>
              {result.warnings.slice(0, 100).map((warning) => (
                <p key={`${warning.row}-${warning.message}`}>Dòng {warning.row} · {warning.customerName || ""} · {warning.serial || ""}: {warning.message}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
