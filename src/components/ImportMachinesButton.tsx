"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type ImportResult = {
  success: boolean;
  message: string;
  summary?: { successCount: number; errorCount: number; createdCount?: number; updatedCount?: number };
  errors?: { row: number; message: string }[];
};

export default function ImportMachinesButton({ onComplete }: { onComplete?: () => void }) {
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
      const response = await fetch("/api/admin/import-machines", { method: "POST", body: formData });
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
          <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Excel import</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">Import seri / danh sách máy</h3>
          <p className="mt-1 text-sm text-slate-500">Nhận trực tiếp file “Seri cần in + Tên máy”. Hệ thống tự tách tên máy, model, công suất/dung tích, bảo hành, số seri và năm sản xuất.</p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="btn-primary inline-flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-black text-white disabled:opacity-60">
          <Icon name="upload" size={17} />
          {loading ? "Đang đọc dữ liệu..." : "IMPORT FILE SERI"}
        </button>
      </div>
      <div className="mt-4 grid gap-2 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 sm:grid-cols-3">
        <span><strong>1.</strong> Chọn file .xlsx</span><span><strong>2.</strong> Kiểm tra số tạo mới/cập nhật</span><span><strong>3.</strong> Mở ID máy để thử QR</span>
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
              {` · Lỗi: ${result.summary.errorCount}`}
            </p>
          )}
          {!!result.errors?.length && <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-white/70 p-2">{result.errors.slice(0, 12).map((error) => <p key={`${error.row}-${error.message}`}>Dòng {error.row}: {error.message}</p>)}</div>}
        </div>
      )}
    </div>
  );
}
