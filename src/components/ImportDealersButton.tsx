"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type ImportResult = {
  success: boolean;
  message: string;
  summary?: { successCount: number; errorCount: number; createdCount?: number; updatedCount?: number; accountCreatedCount?: number };
  errors?: { row: number; message: string }[];
};

export default function ImportDealersButton({ onComplete }: { onComplete?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setFileName(file.name);
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/import-dealers", { method: "POST", body: formData });
      const data = await response.json();
      setResult(data);
      if (data.success) onComplete?.();
    } catch {
      setResult({ success: false, message: "Không thể upload file. Kiểm tra mạng hoặc đăng nhập Admin." });
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="surface-card min-w-0 overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Excel import</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">Import danh sách đại lý</h3>
          <p className="mt-1 text-sm text-slate-500">Nhận file Excel .xlsx. Nếu thiếu Mã đại lý, hệ thống tự sinh mã. Nếu Trạng thái = APPROVED, hệ thống tạo/kích hoạt tài khoản đại lý.</p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="btn-primary inline-flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-black text-white disabled:opacity-60">
          <Icon name="upload" size={17} />
          {loading ? "Đang đọc dữ liệu..." : "IMPORT ĐẠI LÝ"}
        </button>
      </div>
      <div className="mt-4 grid gap-2 rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 sm:grid-cols-3">
        <span><strong>1.</strong> Chọn file .xlsx</span><span><strong>2.</strong> Tạo mới/cập nhật đại lý</span><span><strong>3.</strong> APPROVED là tạo tài khoản luôn</span>
      </div>
      <input ref={inputRef} type="file" accept=".xlsx,.xlsm" onChange={handleUpload} disabled={loading} className="sr-only" />
      {fileName && <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">File: {fileName}</p>}
      {result && (
        <div className={`mt-3 rounded-2xl border p-3 text-sm ${result.success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
          <strong>{result.message}</strong>
          {result.summary && (
            <p className="mt-1">
              Thành công: {result.summary.successCount}
              {typeof result.summary.createdCount === "number" ? ` · Tạo mới: ${result.summary.createdCount}` : ""}
              {typeof result.summary.updatedCount === "number" ? ` · Cập nhật: ${result.summary.updatedCount}` : ""}
              {typeof result.summary.accountCreatedCount === "number" ? ` · Tạo tài khoản: ${result.summary.accountCreatedCount}` : ""}
              {` · Lỗi: ${result.summary.errorCount}`}
            </p>
          )}
          {!!result.errors?.length && <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-white/70 p-2">{result.errors.slice(0, 12).map((error) => <p key={`${error.row}-${error.message}`}>Dòng {error.row}: {error.message}</p>)}</div>}
        </div>
      )}
    </div>
  );
}
