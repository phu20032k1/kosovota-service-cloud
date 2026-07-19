"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { SmartBackButton } from "@/components/ui/SmartBackButton";
import { extractMachineIdFromQr } from "@/lib/qr";

type ScannerInstance = { clear: () => Promise<void> };



export default function ScanQrPage() {
  const router = useRouter();
  const scannerRef = useRef<ScannerInstance | null>(null);
  const handledRef = useRef(false);
  const [manualCode, setManualCode] = useState("");
  const [message, setMessage] = useState("Đang mở camera...");
  const [error, setError] = useState("");

  const openResult = useCallback(async (rawValue: string) => {
  if (handledRef.current) return;

  const machineId = extractMachineIdFromQr(rawValue);

  if (!machineId) {
    setError("QR không hợp lệ.");
    return;
  }

  handledRef.current = true;
  setMessage(`Đã nhận mã ${machineId}. Đang kích hoạt...`);

  try {
    await fetch("/api/machines/activate", {
      method: "POST",
      body: JSON.stringify({
        machineId,
        customerId: null,
      }),
    });

    setMessage("Kích hoạt thành công!");

    void scannerRef.current?.clear().catch(() => undefined);

    router.push(`/qr/${encodeURIComponent(machineId)}`);
  } catch {
    setError("Lỗi kích hoạt máy");
  }
}, [router]);

  useEffect(() => {
    let cancelled = false;
    async function startScanner() {
      try {
        const { Html5QrcodeScanner, Html5QrcodeScanType } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5QrcodeScanner("kosovota-qr-reader", {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA, Html5QrcodeScanType.SCAN_TYPE_FILE],
        }, false);
        scannerRef.current = scanner;
        scanner.render(
          (decodedText) => openResult(decodedText),
          () => undefined,
        );
        setMessage("Đưa QR vào giữa khung hoặc chọn ảnh QR từ máy.");
      } catch (value) {
        setError(value instanceof Error ? value.message : "Không mở được trình quét QR.");
        setMessage("Cậu vẫn có thể nhập mã máy thủ công bên dưới.");
      }
    }
    void startScanner();
    return () => {
      cancelled = true;
      void scannerRef.current?.clear().catch(() => undefined);
      scannerRef.current = null;
    };
  }, [openResult]);

  function submitManual(event: FormEvent) {
    event.preventDefault();
    handledRef.current = false;
    openResult(manualCode);
  }

  return <main className="public-page min-h-screen px-4 py-7 sm:py-12">
    <div className="mx-auto max-w-3xl">
      <header className="surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><Brand size="lg"/><p className="eyebrow mt-6">Quét thiết bị</p><h1 className="mt-2 text-3xl font-black">Quét QR KOSOVOTA</h1><p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">Camera chỉ hoạt động trên <strong>localhost</strong> hoặc website có <strong>HTTPS</strong>. Hãy bấm Cho phép khi trình duyệt hỏi quyền camera.</p></div>
          <SmartBackButton className="btn-secondary" />
        </div>
      </header>

      <section className="surface-card mt-5 overflow-hidden p-4 sm:p-6">
        {error && <Notice kind="error">{error}</Notice>}
        <p className="mb-4 text-center text-sm font-bold text-slate-600">{message}</p>
        <div id="kosovota-qr-reader" className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white"/>
      </section>

      <form onSubmit={submitManual} className="surface-card mt-5 p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">Không quét được camera?</h2>
        <p className="mt-1 text-sm text-slate-500">Nhập ID/seri máy hoặc dán đường dẫn QR.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} className="form-input flex-1" placeholder="Ví dụ: KSV-HT250-00001" required/>
          <button className="btn-primary px-5 py-3 font-extrabold text-white"><Icon name="search" size={18}/> Mở máy</button>
        </div>
      </form>
    </div>
  </main>;
}
