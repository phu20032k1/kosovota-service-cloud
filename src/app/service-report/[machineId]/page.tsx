"use client";

import { ActionSessionBar } from "@/components/ActionSessionBar";
import Link from "next/link";
import { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { findProductByModel } from "@/data/products";
import { Brand } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";

type PhotoKey = "oldFilter" | "newFilter" | "completedMachine";
type PhotoData = { name: string; preview: string; file: File };
type ServiceType = "Thay lõi số 1" | "Thay lõi 1,2,3" | "Thay màng RO" | "Sửa chữa" | "Thay toàn bộ lõi";
type ReportMode = "care" | "repair" | "general";

const CARE_SERVICES: ServiceType[] = ["Thay lõi số 1", "Thay lõi 1,2,3", "Thay màng RO", "Thay toàn bộ lõi"];
const ALL_SERVICES: ServiceType[] = [...CARE_SERVICES, "Sửa chữa"];

function modeFromQuery(value: string | null): ReportMode {
  if (value === "care" || value === "repair") return value;
  return "general";
}

export default function ServiceReportPage() {
  const params = useParams<{ machineId: string }>();
  const searchParams = useSearchParams();
  const machineId = params.machineId;
  const mode = modeFromQuery(searchParams.get("mode"));
  const reportTitle = mode === "care" ? "Báo cáo chăm sóc định kỳ" : mode === "repair" ? "Báo cáo sửa chữa" : "Báo cáo dịch vụ";
  const reportDescription = mode === "care"
    ? "Ghi nhận thay lõi/vật liệu và bảo trì theo kỳ của máy."
    : mode === "repair"
      ? "Ghi nhận tình trạng trước sửa, nội dung sửa chữa và kết quả nghiệm thu."
      : "Ghi nhận việc thay lõi, sửa chữa hoặc bảo trì máy.";

  const [machineInformation, setMachineInformation] = useState({ name: "Thiết bị KOSOVOTA", serial: "Chưa cập nhật", installationDate: "Chưa cập nhật" });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [dealerCode, setDealerCode] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>(mode === "repair" ? "Sửa chữa" : "Thay lõi số 1");
  const [replacementProducts, setReplacementProducts] = useState("");
  const [ownerNote, setOwnerNote] = useState("");
  const [photos, setPhotos] = useState<Record<PhotoKey, PhotoData | null>>({ oldFilter: null, newFilter: null, completedMachine: null });
  const [signatureDrawn, setSignatureDrawn] = useState(false);
  const [signatureUpload, setSignatureUpload] = useState<PhotoData | null>(null);
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setServiceType(mode === "repair" ? "Sửa chữa" : "Thay lõi số 1");
  }, [mode]);

  function prepareSignatureCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#0f172a";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
  }

  useEffect(() => {
    prepareSignatureCanvas();
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => { if (response.ok && result.success) setDealerCode(result.user.dealerCode || ""); })
      .catch(() => undefined);
    fetch(`/api/machines/${encodeURIComponent(machineId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message);
        setMachineInformation({
          name: findProductByModel(result.data.model).name,
          serial: result.data.serial || "Chưa cập nhật",
          installationDate: result.data.installDate ? new Date(result.data.installDate).toLocaleDateString("vi-VN") : "Chưa cập nhật",
        });
      })
      .catch(() => undefined);
  }, [machineId]);

  function getCanvasPosition(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rectangle = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rectangle.left) / rectangle.width) * canvas.width,
      y: ((event.clientY - rectangle.top) / rectangle.height) * canvas.height,
    };
  }

  function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = getCanvasPosition(event);
    context.beginPath();
    context.moveTo(x, y);
    isDrawingRef.current = true;
    setSignatureDrawn(true);
    setFormError("");
  }

  function drawSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.preventDefault();
    const { x, y } = getCanvasPosition(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    event.currentTarget.getContext("2d")?.closePath();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function clearSignature() {
    prepareSignatureCanvas();
    setSignatureDrawn(false);
  }

  function handlePhotoChange(key: PhotoKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotos((current) => ({ ...current, [key]: { name: file.name, preview: URL.createObjectURL(file), file } }));
    setFormError("");
  }

  function handleSignatureUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSignatureUpload({ name: file.name, preview: URL.createObjectURL(file), file });
    setFormError("");
  }

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Upload ảnh thất bại");
    return result.url as string;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError("");

    if (!dealerCode.trim()) {
      setFormError("Tài khoản chưa có mã đại lý. Hãy đăng nhập bằng Đại lý/CTV/KTV được liên kết đại lý.");
      return;
    }
    if (!replacementProducts.trim()) {
      setFormError(mode === "repair" ? "Hãy nhập vật tư/linh kiện đã thay; nếu không thay hãy ghi 'Không thay vật tư'." : "Hãy nhập lõi/vật tư đã thay trước khi gửi báo cáo.");
      return;
    }
    if (!photos.oldFilter) {
      setFormError(mode === "repair" ? "Thiếu ảnh hiện trạng trước sửa." : "Thiếu ảnh lõi/vật liệu cũ.");
      document.getElementById("service-report-photos")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!photos.newFilter) {
      setFormError(mode === "repair" ? "Thiếu ảnh kết quả sau sửa." : "Thiếu ảnh lõi/vật liệu mới.");
      document.getElementById("service-report-photos")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!photos.completedMachine) {
      setFormError("Thiếu ảnh toàn cảnh máy sau hoàn thành.");
      document.getElementById("service-report-photos")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!signatureDrawn && !signatureUpload) {
      setFormError("Khách hàng cần ký trực tiếp hoặc tải ảnh chữ ký trước khi gửi.");
      return;
    }

    setSubmitting(true);
    try {
      const [oldCorePhoto, newCorePhoto, finalPhoto] = await Promise.all([
        uploadFile(photos.oldFilter.file),
        uploadFile(photos.newFilter.file),
        uploadFile(photos.completedMachine.file),
      ]);
      const signature = signatureUpload ? await uploadFile(signatureUpload.file) : canvasRef.current?.toDataURL("image/png") ?? "";
      const response = await fetch("/api/service-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId, dealerCode, serviceType: mode === "repair" ? "Sửa chữa" : serviceType, products: replacementProducts, oldCorePhoto, newCorePhoto, finalPhoto, signature, note: ownerNote }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || `Không gửi được ${reportTitle.toLowerCase()}`);
      setGeneratedReportId(result.data.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error(error);
      setFormError(error instanceof Error ? error.message : "Không gửi được báo cáo. Vui lòng thử lại.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  if (generatedReportId) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg">
        <div className="icon-orb mx-auto"><Icon name="check" size={30} /></div>
        <div className="mt-6 flex justify-center"><Brand compact /></div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Đã gửi {reportTitle.toLowerCase()}</h1>
        <p className="mt-4 text-slate-600">Báo cáo đã được lưu vào hồ sơ máy KOSOVOTA.</p>
        <div className="mt-6 rounded-2xl bg-slate-100 p-5"><p className="text-xs uppercase text-slate-500">Mã báo cáo</p><p className="mt-1 text-xl font-bold text-green-700">{generatedReportId}</p><p className="mt-4 text-xs uppercase text-slate-500">ID máy</p><p className="mt-1 break-all font-bold text-slate-800">{machineId}</p></div>
        <div className="mt-7 space-y-3">
          <Link href={`/qr/${encodeURIComponent(machineId)}`} className="block rounded-xl bg-green-600 px-5 py-4 font-bold text-white hover:bg-green-700">QUAY VỀ TRANG QR</Link>
          <button type="button" onClick={() => { setGeneratedReportId(null); setReplacementProducts(""); setOwnerNote(""); setPhotos({ oldFilter: null, newFilter: null, completedMachine: null }); setSignatureUpload(null); setSignatureDrawn(false); requestAnimationFrame(prepareSignatureCanvas); }} className="w-full rounded-xl border border-slate-300 px-5 py-4 font-bold text-slate-700 hover:bg-slate-50">TẠO BÁO CÁO KHÁC</button>
        </div>
      </section>
    </main>;
  }

  const serviceOptions = mode === "care" ? CARE_SERVICES : ALL_SERVICES;
  const firstPhotoTitle = mode === "repair" ? "Ảnh hiện trạng trước sửa" : "Ảnh lõi/vật liệu cũ đã tháo ra";
  const secondPhotoTitle = mode === "repair" ? "Ảnh kết quả sau sửa" : "Ảnh lõi/vật liệu mới đã thay";

  return <main className="min-h-screen bg-slate-100 px-4 py-8">
    <ActionSessionBar title={reportTitle} />
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-2xl space-y-6">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-widest text-green-700">KOSOVOTA</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{reportTitle}</h1>
        <p className="mt-2 text-sm text-slate-500">{reportDescription}</p>
        {mode !== "general" && <div className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">Luồng QR: {mode === "care" ? "Chăm sóc định kỳ" : "Sửa chữa"}</div>}
      </header>

      {formError && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{formError}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Thông tin máy</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <InformationRow label="ID máy" value={machineId} />
          <InformationRow label="Tên máy" value={machineInformation.name} />
          <InformationRow label="Số Seri" value={machineInformation.serial} />
          <InformationRow label="Ngày lắp đặt" value={machineInformation.installationDate} last />
        </dl>
        <Link href={`/machine-location/${encodeURIComponent(machineId)}`} className="btn-secondary mt-4 inline-flex"><Icon name="map-pin" size={17} /> Ghim/chỉnh vị trí máy</Link>
      </section>

      <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Nội dung {mode === "repair" ? "sửa chữa" : "dịch vụ"}</h2>
        <FormField label="Mã đại lý" required><input type="text" required value={dealerCode} readOnly placeholder="Mã đại lý từ tài khoản đăng nhập" className="form-input uppercase bg-slate-100" /></FormField>
        <FormField label="Dịch vụ thực hiện" required>
          {mode === "repair" ? <input value="Sửa chữa" readOnly className="form-input bg-slate-100 font-bold" /> : <select value={serviceType} onChange={(event) => setServiceType(event.target.value as ServiceType)} className="form-input">{serviceOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>}
        </FormField>
        <FormField label={mode === "repair" ? "Vật tư/linh kiện đã thay" : "Lõi/vật tư thay thế"} required>
          <textarea required value={replacementProducts} onChange={(event) => setReplacementProducts(event.target.value)} placeholder={mode === "repair" ? "Ví dụ: Van điện từ; nếu không thay ghi Không thay vật tư" : "Ví dụ: Lõi số 1, lõi than hoạt tính"} rows={4} className="form-input resize-none" />
        </FormField>
      </section>

      <section id="service-report-photos" className="space-y-7 rounded-2xl bg-white p-5 shadow-sm">
        <div><h2 className="text-lg font-bold text-slate-900">Ảnh báo cáo</h2><p className="mt-1 text-sm text-slate-500">Bắt buộc đủ ảnh trước, ảnh sau và ảnh toàn cảnh sau hoàn thành.</p></div>
        <PhotoInput title={firstPhotoTitle} description={mode === "repair" ? "Chụp rõ tình trạng máy/lỗi trước khi sửa." : "Chụp lõi/vật liệu cũ đặt cạnh máy và thấy rõ thiết bị."} required photo={photos.oldFilter} onChange={(event) => handlePhotoChange("oldFilter", event)} />
        <PhotoInput title={secondPhotoTitle} description={mode === "repair" ? "Chụp rõ máy hoặc bộ phận sau khi đã xử lý." : "Chụp lõi/vật liệu mới đã thay và thấy rõ thiết bị."} required photo={photos.newFilter} onChange={(event) => handlePhotoChange("newFilter", event)} />
        <PhotoInput title="Ảnh toàn cảnh máy sau khi hoàn thành" description="Bắt buộc để xác nhận hiện trạng cuối cùng tại nhà khách hàng." required photo={photos.completedMachine} onChange={(event) => handlePhotoChange("completedMachine", event)} />
      </section>

      <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm">
        <div><h2 className="text-lg font-bold text-slate-900">Chữ ký khách hàng <span className="text-red-600">*</span></h2><p className="mt-1 text-sm text-slate-500">Khách hàng ký bằng chuột, ngón tay hoặc tải ảnh chữ ký.</p></div>
        <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white"><canvas ref={canvasRef} width={700} height={280} onPointerDown={startDrawing} onPointerMove={drawSignature} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onPointerLeave={stopDrawing} className="h-48 w-full touch-none cursor-crosshair bg-white" /></div>
        <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-500">{signatureDrawn ? "Đã có chữ ký trực tiếp." : "Chưa có chữ ký trực tiếp."}</p><button type="button" onClick={clearSignature} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">XÓA CHỮ KÝ</button></div>
        <div className="border-t border-slate-200 pt-5"><p className="mb-3 text-center text-sm font-bold text-slate-500">HOẶC</p><label className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-green-600 hover:bg-green-50"><span className="font-bold text-green-700">TẢI ẢNH CHỮ KÝ</span><input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" /></label>{signatureUpload && <div className="mt-4 overflow-hidden rounded-xl border border-slate-200"><img src={signatureUpload.preview} alt="Ảnh chữ ký khách hàng" className="h-48 w-full bg-white object-contain" /><div className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2"><p className="break-all text-xs text-slate-500">{signatureUpload.name}</p><button type="button" onClick={() => setSignatureUpload(null)} className="shrink-0 text-xs font-bold text-red-600">XÓA</button></div></div>}</div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm"><FormField label="Lưu ý của chủ nhà"><textarea value={ownerNote} onChange={(event) => setOwnerNote(event.target.value)} placeholder="Nhập phản hồi hoặc lưu ý của khách hàng..." rows={5} className="form-input resize-none" /></FormField></section>

      <button type="submit" disabled={submitting} className="w-full rounded-2xl bg-green-600 px-6 py-4 text-lg font-bold text-white shadow-lg hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "ĐANG GỬI, VUI LÒNG CHỜ..." : `GỬI ${reportTitle.toUpperCase()}`}</button>
      <Link href={`/qr/${encodeURIComponent(machineId)}`} className="block text-center text-sm font-semibold text-slate-500 underline">Quay về trang QR</Link>
      <p className="text-center text-xs text-slate-400">Báo cáo sẽ được lưu vào lịch sử máy KOSOVOTA.</p>
    </form>
  </main>;
}

function InformationRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <div className={`flex justify-between gap-4 ${last ? "" : "border-b pb-3"}`}><dt className="text-slate-500">{label}</dt><dd className="text-right font-bold text-slate-900">{value}</dd></div>;
}

function FormField({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}{required && <span className="ml-1 text-red-600">*</span>}</span>{children}</label>;
}

function PhotoInput({ title, description, required = false, photo, onChange }: { title: string; description: string; required?: boolean; photo: PhotoData | null; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div><h3 className="font-bold text-slate-900">{title}{required && <span className="ml-1 text-red-600">*</span>}</h3><p className="mt-1 text-sm text-slate-500">{description}</p><label className="mt-3 block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-green-600 hover:bg-green-50"><span className="font-bold text-green-700">CHỤP HOẶC CHỌN ẢNH</span><input type="file" accept="image/*" capture="environment" onChange={onChange} className="hidden" /></label>{photo && <div className="mt-4 overflow-hidden rounded-xl border border-slate-200"><img src={photo.preview} alt={title} className="h-56 w-full object-cover" /><p className="break-all bg-slate-50 px-3 py-2 text-xs text-slate-500">{photo.name}</p></div>}</div>;
}
