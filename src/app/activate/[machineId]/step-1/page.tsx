"use client";

import { ActionSessionBar } from "@/components/ActionSessionBar";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { findProductByModel } from "@/data/products";

type LocationData = { latitude: number; longitude: number };
type PhotoData = { name: string; preview: string; file: File };
type PhotoKey = "building" | "machine" | "summary";

export default function ActivationStepOnePage() {
  const router = useRouter();
  const params = useParams<{ machineId: string }>();
  const machineId = params.machineId;
  const submittingRef = useRef(false);

  const [machineInformation, setMachineInformation] = useState({ name: "Thiết bị KOSOVOTA", model: "Đang tải...", productionDate: "Chưa cập nhật" });
  const [mode, setMode] = useState<"normal" | "quick">("normal");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [allowTestMode, setAllowTestMode] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationMessage, setLocationMessage] = useState("Chưa lấy vị trí GPS");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [photos, setPhotos] = useState<Record<PhotoKey, PhotoData | null>>({ building: null, machine: null, summary: null });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    fetch(`/api/machines/${encodeURIComponent(machineId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message);
        const product = findProductByModel(result.data.model);
        setMachineInformation({
          name: product.name,
          model: result.data.model,
          productionDate: result.data.manufactureDate ? new Date(result.data.manufactureDate).toLocaleDateString("vi-VN") : "Chưa cập nhật",
        });
        const customer = result.data.customer || null;
        if (customer) {
          setOwnerName(customer.name || "");
          setOwnerPhone(customer.phone || "");
          setOwnerEmail(customer.email || "");
          setAddress(customer.address || "");
        }
        if (typeof result.data.lat === "number" && typeof result.data.lng === "number") {
          setLocation({ latitude: result.data.lat, longitude: result.data.lng });
          setLocationMessage("Máy đã có vị trí GPS. Có thể lấy lại GPS nếu cần.");
        }
      })
      .catch(() => setMachineInformation({ name: "Thiết bị KOSOVOTA", model: "Chưa xác định", productionDate: "Chưa cập nhật" }));
  }, [machineId]);

  function getCurrentLocation() {
    if (!navigator.geolocation) return setLocationMessage("Trình duyệt này không hỗ trợ GPS.");
    setIsGettingLocation(true);
    setLocationMessage("Đang lấy vị trí...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationMessage("Đã lấy vị trí thành công.");
        setIsGettingLocation(false);
      },
      () => {
        setLocationMessage("Không lấy được vị trí. Hãy cho phép trình duyệt truy cập vị trí.");
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function handlePhotoChange(key: PhotoKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotos((current) => ({ ...current, [key]: { name: file.name, preview: URL.createObjectURL(file), file } }));
  }

  async function uploadPhoto(photo: PhotoData | null) {
    if (!photo) return null;
    const formData = new FormData();
    formData.append("file", photo.file);
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Upload ảnh thất bại");
    return result.url as string;
  }

  async function submitStepOne(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || submitting) return;
    setSubmitError("");
    if (!ownerName.trim()) return setSubmitError("Tên chủ nhà là bắt buộc.");
    if (ownerPhone.replace(/\D/g, "").length < 9) return setSubmitError("Số điện thoại chủ nhà chưa hợp lệ.");
    if (!location && !allowTestMode) return setSubmitError("Hãy bấm Lấy GPS trước khi lưu bước 1.");
    if (!allowTestMode && mode === "normal" && (!photos.building || !photos.machine)) return setSubmitError("Cần ảnh mặt tiền và ảnh vị trí máy.");
    if (!allowTestMode && mode === "quick" && !photos.summary) return setSubmitError("Chế độ cực nhanh cần ảnh tóm tắt.");

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const [buildingPhoto, machinePhoto, summaryPhoto] = await Promise.all([
        uploadPhoto(photos.building), uploadPhoto(photos.machine), uploadPhoto(photos.summary),
      ]);
      const response = await fetch("/api/activations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 1,
          machineId,
          mode,
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim(),
          ownerEmail: ownerEmail.trim(),
          address: address.trim(),
          location: location || { latitude: 21.0278, longitude: 105.8342 },
          note: allowTestMode ? "Kích hoạt bằng chế độ test" : undefined,
          photos: { building: buildingPhoto, machine: machinePhoto, summary: summaryPhoto },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không lưu được bước 1.");
      router.push(`/activate/${encodeURIComponent(machineId)}/step-2`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không lưu được bước 1.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <ActionSessionBar title="Kích hoạt máy · Bước 1/2" />
      <form onSubmit={submitStepOne} noValidate className="mx-auto max-w-2xl space-y-6">
        <header className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Bước 1 / 2</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">Thông tin khách hàng & vị trí máy</h1>
          <p className="mt-2 text-sm text-slate-500">Bước này chỉ lưu khách hàng, địa chỉ, GPS và ảnh vị trí. Thông tin đại lý/người lắp nằm riêng ở bước 2.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black"><div className="rounded-xl bg-emerald-600 px-3 py-2 text-center text-white">1 · Khách & vị trí</div><div className="rounded-xl bg-slate-100 px-3 py-2 text-center text-slate-500">2 · Lắp đặt & hoàn tất</div></div>
        </header>

        {submitError && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{submitError}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-900">Máy</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Info label="ID máy" value={machineId}/><Info label="Tên máy" value={machineInformation.name}/><Info label="Model" value={machineInformation.model}/><Info label="Ngày sản xuất" value={machineInformation.productionDate}/>
          </dl>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-900">Khách hàng</h2>
          <Field label="Tên chủ nhà" required><input value={ownerName} onChange={(e)=>setOwnerName(e.target.value)} placeholder="Nguyễn Văn A" className="form-input"/></Field>
          <Field label="Số điện thoại" required><input type="tel" inputMode="tel" value={ownerPhone} onChange={(e)=>setOwnerPhone(e.target.value)} placeholder="0912345678" className="form-input"/></Field>
          <Field label="Email"><input type="email" value={ownerEmail} onChange={(e)=>setOwnerEmail(e.target.value)} placeholder="khachhang@email.com" className="form-input"/></Field>
          <Field label="Địa chỉ lắp đặt"><input value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Số nhà, phường/xã, tỉnh/thành" className="form-input"/></Field>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-900">Vị trí máy</h2>
          <button type="button" onClick={getCurrentLocation} disabled={isGettingLocation} className="btn-primary mt-4 w-full justify-center px-5 py-3 font-black text-white disabled:opacity-50">{isGettingLocation ? "Đang lấy GPS..." : "Lấy GPS tại đây"}</button>
          <div className="mt-3 rounded-xl bg-slate-100 p-4 text-sm"><p className={location ? "font-bold text-emerald-700" : "text-slate-600"}>{locationMessage}</p>{location && <p className="mt-2 text-xs text-slate-500">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>}</div>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={allowTestMode} onChange={(e)=>setAllowTestMode(e.target.checked)} className="mt-1"/><span><strong>Chế độ test:</strong> cho phép dùng tọa độ mẫu và bỏ qua ảnh/GPS thật.</span></label>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-900">Ảnh vị trí</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={()=>setMode("normal")} className={`rounded-xl border p-3 text-left text-sm font-bold ${mode==="normal"?"border-emerald-500 bg-emerald-50":"border-slate-200"}`}>Bình thường<p className="mt-1 text-xs font-normal text-slate-500">Ảnh mặt tiền + ảnh vị trí máy</p></button>
            <button type="button" onClick={()=>setMode("quick")} className={`rounded-xl border p-3 text-left text-sm font-bold ${mode==="quick"?"border-amber-500 bg-amber-50":"border-slate-200"}`}>Cực nhanh<p className="mt-1 text-xs font-normal text-slate-500">Một ảnh tóm tắt</p></button>
          </div>
          <div className="mt-5 space-y-5">{mode === "normal" ? <><PhotoInput title="Ảnh mặt tiền *" photo={photos.building} onChange={(e)=>handlePhotoChange("building",e)}/><PhotoInput title="Ảnh vị trí máy *" photo={photos.machine} onChange={(e)=>handlePhotoChange("machine",e)}/></> : <PhotoInput title="Ảnh tóm tắt *" photo={photos.summary} onChange={(e)=>handlePhotoChange("summary",e)}/>}</div>
        </section>

        <button type="submit" disabled={submitting} className="btn-primary w-full justify-center px-6 py-4 text-base font-black text-white disabled:opacity-50">{submitting ? "Đang lưu..." : "Lưu bước 1 và sang bước 2"}</button>
        <Link href={`/qr/${encodeURIComponent(machineId)}`} className="block text-center text-sm font-bold text-slate-500 underline">Quay lại trang QR</Link>
      </form>
    </main>
  );
}

function Field({label,required=false,children}:{label:string;required?:boolean;children:React.ReactNode}){return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}{required&&<span className="ml-1 text-red-600">*</span>}</span>{children}</label>}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 break-words font-bold text-slate-900">{value}</dd></div>}
function PhotoInput({title,photo,onChange}:{title:string;photo:PhotoData|null;onChange:(event:ChangeEvent<HTMLInputElement>)=>void}){return <div><p className="font-bold text-slate-900">{title}</p><label className="mt-2 block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-emerald-500"><span className="font-bold text-emerald-700">Chụp hoặc chọn ảnh</span><input type="file" accept="image/*" capture="environment" onChange={onChange} className="hidden"/></label>{photo&&<div className="mt-3 overflow-hidden rounded-xl border"><img src={photo.preview} alt={title} className="h-48 w-full object-cover"/><p className="bg-slate-50 px-3 py-2 text-xs text-slate-500">{photo.name}</p></div>}</div>}
