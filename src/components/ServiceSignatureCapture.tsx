"use client";

import { ChangeEvent, useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";

type Props = {
  customerName: string;
  signatureImage: string;
  onCustomerNameChange: (value: string) => void;
  onSignatureImageChange: (value: string) => void;
  disabled?: boolean;
};

export function ServiceSignatureCapture({
  customerName,
  signatureImage,
  onCustomerNameChange,
  onSignatureImageChange,
  disabled = false,
}: Props) {
  const [mode, setMode] = useState<"draw" | "photo">("draw");
  const [draftSignature, setDraftSignature] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function uploadFile(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "service-signature");
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result.success || !result.url) throw new Error(result.message || "Không lưu được chữ ký.");
      onSignatureImageChange(result.url);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được chữ ký.");
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function saveDrawnSignature() {
    if (!draftSignature) {
      setError("Khách hàng cần ký vào vùng chữ ký trước.");
      return;
    }
    try {
      const blob = await (await fetch(draftSignature)).blob();
      const file = new File([blob], `chu-ky-${Date.now()}.png`, { type: "image/png" });
      await uploadFile(file);
    } catch {
      setError("Không tạo được ảnh chữ ký. Vui lòng ký lại hoặc chụp ảnh chữ ký.");
    }
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    event.target.value = "";
  }

  function clearSignature() {
    setDraftSignature("");
    onSignatureImageChange("");
    setError("");
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <h4 className="font-black text-slate-950">Xác nhận của khách hàng</h4>
        <p className="mt-1 text-sm text-slate-500">Nhập tên người xác nhận và lấy chữ ký điện tử bằng một trong hai cách.</p>
      </div>

      <label className="block">
        <span className="field-label">Tên khách xác nhận *</span>
        <input
          value={customerName}
          onChange={(event) => onCustomerNameChange(event.target.value)}
          disabled={disabled}
          autoComplete="name"
          placeholder="Họ và tên người xác nhận"
          className="w-full"
        />
      </label>

      <div className="grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setMode("draw")}
          disabled={disabled || uploading}
          className={`rounded-lg px-3 py-2.5 text-sm font-black ${mode === "draw" ? "bg-emerald-600 text-white" : "text-slate-600"}`}
        >
          Ký trực tiếp
        </button>
        <button
          type="button"
          onClick={() => setMode("photo")}
          disabled={disabled || uploading}
          className={`rounded-lg px-3 py-2.5 text-sm font-black ${mode === "photo" ? "bg-emerald-600 text-white" : "text-slate-600"}`}
        >
          Chụp / chọn ảnh
        </button>
      </div>

      {mode === "draw" ? (
        <div className="space-y-3">
          <SignaturePad value={draftSignature} onChange={(value) => { setDraftSignature(value); setError(""); }} />
          <button
            type="button"
            onClick={() => void saveDrawnSignature()}
            disabled={disabled || uploading || !draftSignature}
            className="btn-primary w-full p-3 font-black text-white disabled:opacity-50"
          >
            {uploading ? "Đang lưu chữ ký..." : "Lưu chữ ký điện tử"}
          </button>
        </div>
      ) : (
        <label className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 text-center hover:border-emerald-500 hover:bg-emerald-50">
          <span className="font-black text-emerald-700">📷 Chụp hoặc chọn ảnh chữ ký</span>
          <span className="mt-1 block text-xs text-slate-500">Có thể mở camera điện thoại hoặc chọn ảnh có sẵn.</span>
          <input type="file" accept="image/*" capture="environment" onChange={(event) => void choosePhoto(event)} disabled={disabled || uploading} className="hidden" />
        </label>
      )}

      {signatureImage && (
        <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white">
          <img src={signatureImage} alt="Chữ ký điện tử của khách hàng" className="h-40 w-full object-contain" />
          <div className="flex items-center justify-between gap-3 border-t bg-emerald-50 px-3 py-2">
            <span className="text-xs font-black text-emerald-700">Đã lưu chữ ký điện tử</span>
            <button type="button" onClick={clearSignature} disabled={disabled || uploading} className="text-xs font-black text-rose-600">Xóa / ký lại</button>
          </div>
        </div>
      )}

      {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
    </section>
  );
}
