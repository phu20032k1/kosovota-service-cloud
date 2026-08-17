"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { Brand } from "@/components/ui/Brand";
import { Notice } from "@/components/ui/Notice";
import { SmartBackButton } from "@/components/ui/SmartBackButton";

type RegistrationType = "commercial" | "service" | "collaborator";
type LocationData = { latitude: number; longitude: number };
type PhotoData = { name: string; preview: string; file: File };
type PhotoKey = "portrait" | "store" | "warehouse";

const provinces = [
  { name: "Hà Nội", code: "HN" },
  { name: "Hà Giang", code: "HG" },
  { name: "Cao Bằng", code: "CB" },
  { name: "Bắc Kạn", code: "BK" },
  { name: "Tuyên Quang", code: "TQ" },
  { name: "Lào Cai", code: "LC" },
  { name: "Điện Biên", code: "DB" },
  { name: "Lai Châu", code: "LCH" },
  { name: "Sơn La", code: "SL" },
  { name: "Yên Bái", code: "YB" },
  { name: "Hòa Bình", code: "HB" },
  { name: "Thái Nguyên", code: "TN" },
  { name: "Lạng Sơn", code: "LS" },
  { name: "Quảng Ninh", code: "QN" },
  { name: "Bắc Giang", code: "BG" },
  { name: "Phú Thọ", code: "PT" },
  { name: "Vĩnh Phúc", code: "VP" },
  { name: "Bình Định", code: "BDI" },
  { name: "Phú Yên", code: "PY" },
  { name: "Khánh Hòa", code: "KH" },
  { name: "Ninh Thuận", code: "NT" },
  { name: "Bình Thuận", code: "BT" },
  { name: "Kon Tum", code: "KT" },
  { name: "Gia Lai", code: "GL" },
  { name: "Đắk Lắk", code: "DL" },
  { name: "Đắk Nông", code: "DN" },
  { name: "Lâm Đồng", code: "LD" },
  { name: "Bình Phước", code: "BP" },
  { name: "Tây Ninh", code: "TNI" },
  { name: "Bình Dương", code: "BD" },
  { name: "Đồng Nai", code: "DNA" },
  { name: "Bà Rịa - Vũng Tàu", code: "VT" },
  { name: "Hồ Chí Minh", code: "HCM" },
  { name: "Cà Mau", code: "CM" },
];

const serviceOptions = [
  "Lắp đặt máy lọc nước nóng lạnh",
  "Sửa chữa máy lọc nước nóng lạnh",
  "Lắp đặt lọc tổng gia đình",
  "Sửa chữa lọc tổng gia đình",
  "Lắp đặt dàn lọc tinh khiết",
  "Sửa chữa dàn lọc tinh khiết",
  "Điện nước cơ bản",
];

const typeOptions: Array<{ value: RegistrationType; title: string; description: string; tone: string }> = [
  {
    value: "commercial",
    title: "Đại lý thương mại",
    description: "Bán hàng đơn thuần, không nhận lệnh dịch vụ kỹ thuật.",
    tone: "border-yellow-400 bg-yellow-50",
  },
  {
    value: "service",
    title: "Đại lý dịch vụ",
    description: "Có kỹ thuật viên bảo hành, sửa chữa và nhận điều phối.",
    tone: "border-green-500 bg-green-50",
  },
  {
    value: "collaborator",
    title: "CTV / Thợ tự do",
    description: "Nhận việc theo vị trí GPS và năng lực sửa chữa.",
    tone: "border-red-500 bg-red-50",
  },
];

export default function DealerRegisterPage() {
  const [registrationType, setRegistrationType] = useState<RegistrationType>("service");
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [street, setStreet] = useState("");
  const [ward, setWard] = useState("");
  const [province, setProvince] = useState("HN");
  const [locationType, setLocationType] = useState("Cửa hàng");
  const [technicianCount, setTechnicianCount] = useState("1");
  const [serviceArea, setServiceArea] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [taxCode, setTaxCode] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [videoName, setVideoName] = useState("");
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationMessage, setLocationMessage] = useState("Chưa lấy vị trí GPS");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [photos, setPhotos] = useState<Record<PhotoKey, PhotoData | null>>({
    portrait: null,
    store: null,
    warehouse: null,
  });
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  function getCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Trình duyệt không hỗ trợ GPS.");
      return;
    }
    setIsGettingLocation(true);
    setLocationMessage("Đang lấy vị trí...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationMessage("Đã lấy vị trí thành công.");
        setIsGettingLocation(false);
      },
      () => {
        setLocationMessage("Không lấy được vị trí. Hãy cho phép trình duyệt truy cập GPS.");
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function handlePhotoChange(key: PhotoKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotos((current) => ({
      ...current,
      [key]: { name: file.name, preview: URL.createObjectURL(file), file },
    }));
  }

  function toggleService(service: string) {
    setSelectedServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service],
    );
  }

  function changeRegistrationType(value: RegistrationType) {
    setRegistrationType(value);
    if (value === "commercial") {
      setTechnicianCount("0");
      setSelectedServices([]);
    } else if (technicianCount === "0") {
      setTechnicianCount("1");
    }
  }

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("purpose", "dealer-registration");
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Upload ảnh thất bại");
    return result.url as string;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!ward.trim()) {
      setFormError("Bắt buộc nhập Xã/Phường để sinh phần BB trong mã đại lý.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!location) {
      setFormError("Anh/chị cần bấm Lấy vị trí GPS trước khi gửi hồ sơ.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!photos.portrait || !photos.store) {
      setFormError("Cần ảnh chân dung và ảnh cửa hàng/mặt tiền.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (registrationType !== "commercial" && selectedServices.length === 0) {
      setFormError("Đại lý dịch vụ/CTV cần chọn ít nhất một năng lực sửa chữa.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (phone.replace(/\D/g, "").length < 9) {
      setFormError("Số điện thoại chưa hợp lệ.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!citizenId.trim() || !bankAccount.trim()) {
      setFormError("CCCD và số tài khoản là thông tin bắt buộc.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      const portraitPhoto = await uploadFile(photos.portrait.file);
      const storePhoto = await uploadFile(photos.store.file);
      const warehousePhoto = photos.warehouse ? await uploadFile(photos.warehouse.file) : null;
      const selectedProvince = provinces.find((item) => item.code === province) || provinces[0];

      const response = await fetch("/api/dealers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provinceCode: selectedProvince.code,
          province: selectedProvince.name,
          ward,
          registrationType,
          name: companyName || fullName,
          representativeName: fullName,
          phone,
          address: [houseNumber, street, ward, selectedProvince.name].filter(Boolean).join(", "),
          lat: location.latitude,
          lng: location.longitude,
          services: registrationType === "commercial" ? [] : selectedServices,
          technicianCount: registrationType === "commercial" ? 0 : Number(technicianCount || 1),
          extra: {
            registrationType,
            companyName,
            birthDate,
            locationType,
            serviceArea,
            taxCode,
            citizenId,
            bankAccount,
            accountHolder,
            bankName,
            portraitPhoto,
            storePhoto,
            warehousePhoto,
            videoName: videoName || null,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không đăng ký được đại lý");
      setGeneratedId(result.data.dealerCode);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error(error);
      setFormError(error instanceof Error ? error.message : "Không gửi được đăng ký. Vui lòng thử lại.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  if (generatedId) {
    return (
      <main className="auth-page flex min-h-screen items-center justify-center px-4 py-10">
        <section className="auth-panel w-full max-w-lg p-8 text-center">
          <div className="flex justify-center"><Brand compact /></div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Đăng ký thành công</h1>
          <p className="mt-3 text-slate-600">Mã đại lý được hệ thống tự động sinh:</p>
          <div className="mt-4 rounded-2xl bg-emerald-50 p-5">
            <p className="text-2xl font-black tracking-wider text-emerald-700">{generatedId}</p>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Cấu trúc: <strong>AA + BB + Năm 2 số + STT 4 số</strong>. Hồ sơ đang chờ KOSOVOTA xét duyệt.
          </p>
          <SmartBackButton
            label="Quay lại"
            className="mt-7 w-full justify-center rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white hover:bg-emerald-700"
          />
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell px-4 py-8">
      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
        <header className="surface-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-emerald-700">KOSOVOTA</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Đăng ký Đại lý / CTV</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Không cần nhập mã thủ công. Hệ thống tự sinh theo <strong>Tỉnh + Xã/Phường + Năm + Số thứ tự</strong>.
              </p>
            </div>
            <SmartBackButton className="btn-secondary" />
          </div>
        </header>

        {formError && <Notice kind="error">{formError}</Notice>}

        <section className="surface-card space-y-4 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">1. Nhóm đại lý</h2>
            <p className="mt-1 text-sm text-slate-500">Nhóm này quyết định màu icon trên bản đồ và khả năng nhận lệnh kỹ thuật.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {typeOptions.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-2xl border-2 p-4 transition ${
                  registrationType === option.value ? option.tone : "border-slate-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="registrationType"
                  checked={registrationType === option.value}
                  onChange={() => changeRegistrationType(option.value)}
                  className="mr-2"
                />
                <span className="font-black text-slate-900">{option.title}</span>
                <p className="mt-2 text-sm leading-6 text-slate-600">{option.description}</p>
              </label>
            ))}
          </div>
        </section>

        <section className="surface-card space-y-4 p-5">
          <h2 className="text-lg font-bold text-slate-900">2. Thông tin hồ sơ</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên công ty/cửa hàng">
              <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Có thể để trống nếu đăng ký cá nhân" />
            </Field>
            <Field label="Họ tên người đại diện *">
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </Field>
            <Field label="Số điện thoại *">
              <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" required />
            </Field>
            <Field label="Ngày sinh">
              <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
            </Field>
          </div>
        </section>

        <section className="surface-card space-y-4 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">3. Địa chỉ để sinh mã</h2>
            <p className="mt-1 text-sm text-slate-500">AA lấy từ mã Tỉnh; BB được sinh từ tên Xã/Phường.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tỉnh/Thành phố *">
              <select value={province} onChange={(event) => setProvince(event.target.value)}>
                {provinces.map((item) => (
                  <option key={item.code} value={item.code}>{item.name} ({item.code})</option>
                ))}
              </select>
            </Field>
            <Field label="Xã/Phường *">
              <input value={ward} onChange={(event) => setWard(event.target.value)} placeholder="Ví dụ: Phường Bến Nghé" required />
            </Field>
            <Field label="Số nhà">
              <input value={houseNumber} onChange={(event) => setHouseNumber(event.target.value)} />
            </Field>
            <Field label="Đường/Thôn/Xóm">
              <input value={street} onChange={(event) => setStreet(event.target.value)} />
            </Field>
            <Field label="Loại địa điểm">
              <select value={locationType} onChange={(event) => setLocationType(event.target.value)}>
                <option>Cửa hàng</option>
                <option>Nhà riêng</option>
                <option>Kho</option>
                <option>Văn phòng</option>
              </select>
            </Field>
            <Field label="Khu vực có thể phục vụ">
              <input value={serviceArea} onChange={(event) => setServiceArea(event.target.value)} placeholder="Quận/huyện hoặc bán kính phục vụ" />
            </Field>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-800">Vị trí GPS *</p>
                <p className="mt-1 text-sm text-slate-500">{locationMessage}</p>
                {location && (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </p>
                )}
              </div>
              <button type="button" onClick={getCurrentLocation} disabled={isGettingLocation} className="btn-secondary">
                {isGettingLocation ? "Đang lấy GPS..." : "Lấy vị trí GPS"}
              </button>
            </div>
          </div>
        </section>

        {registrationType !== "commercial" && (
          <section className="surface-card space-y-4 p-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">4. Năng lực sửa chữa</h2>
              <p className="mt-1 text-sm text-slate-500">Dùng để lọc CTV/đại lý và xếp Top 10 gần nhất khi CSKH điều phối.</p>
            </div>
            <Field label="Số kỹ thuật viên">
              <input
                type="number"
                min="1"
                value={technicianCount}
                onChange={(event) => setTechnicianCount(event.target.value)}
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              {serviceOptions.map((service) => (
                <label key={service} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(service)}
                    onChange={() => toggleService(service)}
                    className="mt-1"
                  />
                  <span className="text-sm font-semibold text-slate-700">{service}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        <section className="surface-card space-y-4 p-5">
          <h2 className="text-lg font-bold text-slate-900">5. Đối soát và xác minh</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="CCCD *">
              <input value={citizenId} onChange={(event) => setCitizenId(event.target.value)} required />
            </Field>
            <Field label="Mã số thuế">
              <input value={taxCode} onChange={(event) => setTaxCode(event.target.value)} />
            </Field>
            <Field label="Số tài khoản *">
              <input value={bankAccount} onChange={(event) => setBankAccount(event.target.value)} required />
            </Field>
            <Field label="Chủ tài khoản">
              <input value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} />
            </Field>
            <Field label="Ngân hàng">
              <input value={bankName} onChange={(event) => setBankName(event.target.value)} />
            </Field>
            <Field label="Tên video xác minh (nếu có)">
              <input value={videoName} onChange={(event) => setVideoName(event.target.value)} />
            </Field>
          </div>
        </section>

        <section className="surface-card space-y-4 p-5">
          <h2 className="text-lg font-bold text-slate-900">6. Ảnh hồ sơ</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <PhotoField label="Ảnh chân dung *" photo={photos.portrait} onChange={(event) => handlePhotoChange("portrait", event)} />
            <PhotoField label="Ảnh cửa hàng/mặt tiền *" photo={photos.store} onChange={(event) => handlePhotoChange("store", event)} />
            <PhotoField label="Ảnh kho (nếu có)" photo={photos.warehouse} onChange={(event) => handlePhotoChange("warehouse", event)} />
          </div>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full justify-center px-6 py-4 text-base font-black text-white disabled:opacity-60"
        >
          {submitting ? "Đang gửi hồ sơ..." : "Gửi đăng ký và sinh mã tự động"}
        </button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function PhotoField({
  label,
  photo,
  onChange,
}: {
  label: string;
  photo: PhotoData | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <span className="block text-sm font-bold text-slate-700">{label}</span>
      <input type="file" accept="image/*" onChange={onChange} className="mt-3 block w-full text-sm" />
      {photo && (
        <div className="mt-3">
          <img src={photo.preview} alt={label} className="h-32 w-full rounded-xl object-cover" />
          <p className="mt-2 truncate text-xs text-slate-500">{photo.name}</p>
        </div>
      )}
    </label>
  );
}
