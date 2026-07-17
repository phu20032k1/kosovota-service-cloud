"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type Result = { success: boolean; message: string; summary?: { successCount: number; createdCount: number; updatedCount: number; linkedMachineCount: number; errorCount: number }; errors?: { row: number; message: string }[] };

export default function ImportCustomersButton({ onComplete }: { onComplete?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true); setResult(null);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/admin/import-customers", { method: "POST", body });
      const data = await response.json().catch(() => ({ success: false, message: "Máy chủ trả về dữ liệu không hợp lệ." }));
      setResult(data);
      if (data.success) onComplete?.();
    } catch { setResult({ success: false, message: "Không thể tải file lên. Vui lòng kiểm tra kết nối." }); }
    finally { setLoading(false); event.target.value = ""; }
  }

  return <section className="surface-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Excel import</p><h2 className="mt-1 text-lg font-black">Nhập khách hàng hàng loạt</h2><p className="mt-1 text-sm text-slate-500">Bắt buộc: Tên khách hàng, Số điện thoại. Có thể thêm Địa chỉ, Email, CSKH phụ trách, Seri và Model. Các dòng trùng số điện thoại được gom vào cùng một khách hàng.</p></div><button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="btn-primary px-4 py-3 text-sm font-black text-white disabled:opacity-60"><Icon name="upload" size={17}/>{loading ? "Đang nhập..." : "CHỌN FILE KHÁCH HÀNG"}</button></div><input ref={inputRef} type="file" accept=".xlsx,.xlsm" onChange={upload} className="sr-only" />{result&&<div className={`mt-4 rounded-2xl border p-3 text-sm ${result.success?"border-emerald-200 bg-emerald-50 text-emerald-900":"border-rose-200 bg-rose-50 text-rose-900"}`}><strong>{result.message}</strong>{result.summary&&<p className="mt-1">Thành công: {result.summary.successCount} · Tạo mới: {result.summary.createdCount} · Cập nhật: {result.summary.updatedCount} · Gắn máy: {result.summary.linkedMachineCount} · Lỗi: {result.summary.errorCount}</p>}{!!result.errors?.length&&<div className="mt-2 max-h-40 overflow-auto rounded-xl bg-white/70 p-2">{result.errors.slice(0,50).map(error=><p key={`${error.row}-${error.message}`}>Dòng {error.row}: {error.message}</p>)}</div>}</div>}</section>;
}
