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
  const [machineId, setMachineId] = useState<string | null>(null);
  const [message, setMessage] = useState("Đang mở camera...");
  const [error, setError] = useState("");

  const openResult = useCallback(async (rawValue: string) => {
    if (handledRef.current) return;
    const parsedMachineId = extractMachineIdFromQr(rawValue);
    if (!parsedMachineId) {
      setError("QR không hợp lệ.");
      return;
    }

    handledRef.current = true;
    setError("");
    setMachineId(parsedMachineId);
    setMessage(`Đã nhận mã ${parsedMachineId}. Chọn chức năng cần thực hiện.`);
    await scannerRef.current?.clear().catch(() => undefined);
    scannerRef.current = null;
  }, []);

  useEffect(() => {
    if (machineId) return;
    let cancelled = false;

    async function startScanner() {
      try {
        const html5qrcode = await import("html5-qrcode");
        if (cancelled) return;
        const Html5QrcodeScanner =
          html5qrcode.Html5QrcodeScanner ??
          html5qrcode.default?.Html5QrcodeScanner ??
          html5qrcode.default;
        const Html5QrcodeScanType =
          html5qrcode.Html5QrcodeScanType ??
          html5qrcode.default?.Html5QrcodeScanType;

        if (!Html5QrcodeScanner || !Html5QrcodeScanType) {
          throw new Error("Không thể khởi tạo trình quét QR.");
        }

        const scanner = new Html5QrcodeScanner(
          "kosovota-qr-reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [
              Html5QrcodeScanType.SCAN_TYPE_CAMERA,
              Html5QrcodeScanType.SCAN_TYPE_FILE,
            ],
          },
          false,
        );
        scannerRef.current = scanner;
        scanner.render(
          (decodedText) => void openResult(decodedText),
          (scanError) => console.debug("QR scan warning:", scanError),
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
  }, [machineId, openResult]);

  function submitManual(event: FormEvent) {
    event.preventDefault();
    handledRef.current = false;
    void openResult(manualCode);
  }

  function scanAgain() {
    handledRef.current = false;
    setMachineId(null);
    setManualCode("");
    setError("");
    setMessage("Đang mở camera...");
  }

  return (
    <main className="public-page min-h-screen px-4 py-7 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="surface-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Brand size="lg" />
              <p className="eyebrow mt-6">QR 3-trong-1</p>
              <h1 className="mt-2 text-3xl font-black">Quét QR KOSOVOTA</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                Một mã QR dùng chung cho <strong>Kích hoạt máy</strong>, <strong>Đăng ký đại lý</strong> và <strong>Báo cáo dịch vụ</strong>.
              </p>
            </div>
            <SmartBackButton className="btn-secondary" />
          </div>
        </header>

        {machineId ? (
          <section className="surface-card mt-5 p-5 sm:p-7">
            <div className="rounded-2xl bg-emerald-50 p-5 text-center">
              <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Đã nhận thiết bị</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{machineId}</p>
              <p className="mt-2 text-sm text-slate-600">{message}</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <button
                type="button"
                onClick={() => router.push(`/activate/${encodeURIComponent(machineId)}/step-1`)}
                className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 text-left transition hover:border-emerald-500"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white">
                  <Icon name="check" size={20} />
                </span>
                <strong className="mt-4 block text-lg text-slate-900">1. Kích hoạt máy</strong>
                <span className="mt-2 block text-sm leading-6 text-slate-600">Mở quy trình kích hoạt và bàn giao thiết bị.</span>
              </button>

              <button
                type="button"
                onClick={() => router.push(`/dealer-register?machineId=${encodeURIComponent(machineId)}`)}
                className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 text-left transition hover:border-blue-500"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-white">
                  <Icon name="store" size={20} />
                </span>
                <strong className="mt-4 block text-lg text-slate-900">2. Đăng ký đại lý</strong>
                <span className="mt-2 block text-sm leading-6 text-slate-600">Đăng ký Đại lý/CTV và sinh mã tự động.</span>
              </button>

              <button
                type="button"
                onClick={() => router.push(`/service-report/${encodeURIComponent(machineId)}`)}
                className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 text-left transition hover:border-amber-500"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500 text-white">
                  <Icon name="wrench" size={20} />
                </span>
                <strong className="mt-4 block text-lg text-slate-900">3. Báo cáo dịch vụ</strong>
                <span className="mt-2 block text-sm leading-6 text-slate-600">Mở phiếu báo cáo sửa chữa/thay lõi của máy.</span>
              </button>
            </div>

            <button type="button" onClick={scanAgain} className="btn-secondary mt-5 w-full justify-center py-3">
              <Icon name="refresh" size={18} /> Quét mã khác
            </button>
          </section>
        ) : (
          <>
            <section className="surface-card mt-5 overflow-hidden p-4 sm:p-6">
              {error && <Notice kind="error">{error}</Notice>}
              <p className="mb-4 text-center text-sm font-bold text-slate-600">{message}</p>
              <div id="kosovota-qr-reader" className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white" />
            </section>

            <form onSubmit={submitManual} className="surface-card mt-5 p-5 sm:p-6">
              <h2 className="text-lg font-extrabold">Không quét được camera?</h2>
              <p className="mt-1 text-sm text-slate-500">Nhập ID/seri máy hoặc dán đường dẫn QR.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  className="form-input flex-1"
                  placeholder="Ví dụ: KSV-HT250-00001"
                  required
                />
                <button className="btn-primary px-5 py-3 font-extrabold text-white">
                  <Icon name="search" size={18} /> Mở lựa chọn
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
