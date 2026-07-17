"use client";

import {
  ChangeEvent,
  FormEvent,
  type ReactNode,
  useState,
} from "react";
import { Brand } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { SmartBackButton } from "@/components/ui/SmartBackButton";

type RegistrationType = "dealer" | "collaborator";

type LocationData = {
  latitude: number;
  longitude: number;
};

type PhotoData = {
  name: string;
  preview: string;
  file: File;
};

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

export default function DealerRegisterPage() {
  const [registrationType, setRegistrationType] =
    useState<RegistrationType>("dealer");

  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [houseNumber, setHouseNumber] = useState("");
  const [street, setStreet] = useState("");
  const [ward, setWard] = useState("");
  const [province, setProvince] = useState("HN");

  const [locationType, setLocationType] =
    useState("Cửa hàng");

  const [technicianCount, setTechnicianCount] =
    useState("1");

  const [serviceArea, setServiceArea] = useState("");
  const [selectedServices, setSelectedServices] =
    useState<string[]>([]);

  const [taxCode, setTaxCode] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");

  const [videoName, setVideoName] = useState("");

  const [location, setLocation] =
    useState<LocationData | null>(null);

  const [locationMessage, setLocationMessage] =
    useState("Chưa lấy vị trí GPS");

  const [isGettingLocation, setIsGettingLocation] =
    useState(false);

  const [photos, setPhotos] = useState<
    Record<PhotoKey, PhotoData | null>
  >({
    portrait: null,
    store: null,
    warehouse: null,
  });

  const [generatedId, setGeneratedId] =
    useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  function getCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage(
        "Trình duyệt không hỗ trợ GPS.",
      );
      return;
    }

    setIsGettingLocation(true);
    setLocationMessage("Đang lấy vị trí...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setLocationMessage("Đã lấy vị trí thành công.");
        setIsGettingLocation(false);
      },
      () => {
        setLocationMessage(
          "Không lấy được vị trí. Hãy cho phép trình duyệt truy cập GPS.",
        );

        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }

  function handlePhotoChange(
    key: PhotoKey,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setPhotos((currentPhotos) => ({
      ...currentPhotos,
      [key]: {
  name: file.name,
  preview: URL.createObjectURL(file),
  file,
},
    }));
  }

  function toggleService(service: string) {
    setSelectedServices((currentServices) => {
      if (currentServices.includes(service)) {
        return currentServices.filter(
          (item) => item !== service,
        );
      }

      return [...currentServices, service];
    });
  }


  async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", "dealer-registration");

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Upload ảnh thất bại");
  }

  return result.url as string;
}

async function handleSubmit(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  if (!location) {
    setFormError("Anh/chị cần bấm Lấy vị trí GPS trước khi gửi hồ sơ.");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (!photos.portrait) {
    setFormError("Anh/chị cần chọn ảnh chân dung.");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (!photos.store) {
    setFormError("Anh/chị cần chọn ảnh cửa hàng hoặc mặt tiền.");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (selectedServices.length === 0) {
    setFormError("Hãy chọn ít nhất một dịch vụ.");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (phone.length < 9) {
    setFormError("Số điện thoại chưa hợp lệ.");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  setSubmitting(true);
  setFormError("");

  try {
    const portraitPhoto = await uploadFile(photos.portrait.file);
    const storePhoto = await uploadFile(photos.store.file);

    const warehousePhoto = photos.warehouse
      ? await uploadFile(photos.warehouse.file)
      : null;

    const selectedProvince = provinces.find(
      (item) => item.code === province,
    );

    const provinceCode = selectedProvince?.code ?? "HN";
    const typeCode =
      registrationType === "dealer" ? "DL" : "CTV";
    const response = await fetch("/api/dealers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provinceCode,
        typeCode,
        name: companyName || fullName,
        representativeName: fullName,
        phone,
        province,
        address: `${houseNumber}, ${street}, ${ward}, ${selectedProvince?.name ?? province}`,
        lat: location.latitude,
        lng: location.longitude,
        services: selectedServices.join(", "),
        technicianCount: Number(technicianCount),
        status: "PENDING",
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

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không đăng ký được đại lý");
    }

    setGeneratedId(result.data.dealerCode);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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
          <div className="icon-orb mx-auto"><Icon name="check" size={30} /></div>

          <div className="mt-6 flex justify-center"><Brand compact /></div>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Đăng ký thành công
          </h1>

          <p className="mt-4 text-slate-600">
            Mã đăng ký của anh/chị là:
          </p>

          <div className="mt-4 rounded-2xl bg-green-50 p-5">
            <p className="text-2xl font-bold text-emerald-700">
              {generatedId}
            </p>
          </div>

          <p className="mt-5 text-sm text-slate-500">
            Nhân viên KOSOVOTA sẽ liên hệ trong
            1–2 ngày để kích hoạt.
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
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-3xl space-y-6"
      >
        <header className="surface-card p-6">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-700">
            KOSOVOTA
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Đăng ký Đại lý / CTV
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Thông tin được bảo mật và chỉ dùng để xét duyệt hồ sơ đại lý.
          </p>
        </header>

        {formError && <Notice kind="error">{formError}</Notice>}

        <section className="surface-card space-y-5 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Loại đăng ký
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <label
              className={`cursor-pointer rounded-xl border p-4 ${
                registrationType === "dealer"
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="registrationType"
                checked={registrationType === "dealer"}
                onChange={() =>
                  setRegistrationType("dealer")
                }
                className="mr-2"
              />

              <span className="font-bold">Đại lý</span>
            </label>

            <label
              className={`cursor-pointer rounded-xl border p-4 ${
                registrationType === "collaborator"
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="registrationType"
                checked={
                  registrationType === "collaborator"
                }
                onChange={() =>
                  setRegistrationType("collaborator")
                }
                className="mr-2"
              />

              <span className="font-bold">CTV</span>
            </label>
          </div>
        </section>

        <section className="surface-card space-y-5 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Thông tin cơ bản
          </h2>

          <FormField label="Tên công ty / cửa hàng">
            <input
              type="text"
              value={companyName}
              onChange={(event) =>
                setCompanyName(event.target.value)
              }
              placeholder="Không bắt buộc"
              className="form-input"
            />
          </FormField>

          <FormField label="Họ và tên" required>
            <input
              type="text"
              required
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              placeholder="Nhập họ và tên"
              className="form-input"
            />
          </FormField>

          <FormField label="Số điện thoại" required>
            <input
              type="tel"
              required
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target.value.replace(/\D/g, ""),
                )
              }
              placeholder="Ví dụ: 0987654321"
              className="form-input"
            />
          </FormField>

          <FormField label="Ngày sinh" required>
            <input
              type="date"
              required
              value={birthDate}
              onChange={(event) =>
                setBirthDate(event.target.value)
              }
              className="form-input"
            />
          </FormField>

          <PhotoInput
            title="Ảnh chân dung"
            required
            photo={photos.portrait}
            onChange={(event) =>
              handlePhotoChange("portrait", event)
            }
          />
        </section>

        <section className="surface-card space-y-5 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Địa chỉ
          </h2>

          <FormField label="Số nhà" required>
            <input
              type="text"
              required
              value={houseNumber}
              onChange={(event) =>
                setHouseNumber(event.target.value)
              }
              placeholder="Ví dụ: Số 15"
              className="form-input"
            />
          </FormField>

          <FormField label="Đường" required>
            <input
              type="text"
              required
              value={street}
              onChange={(event) =>
                setStreet(event.target.value)
              }
              placeholder="Tên đường"
              className="form-input"
            />
          </FormField>

          <FormField label="Xã / phường" required>
            <input
              type="text"
              required
              value={ward}
              onChange={(event) =>
                setWard(event.target.value)
              }
              placeholder="Tên xã hoặc phường"
              className="form-input"
            />
          </FormField>

          <FormField label="Tỉnh / thành phố" required>
            <select
              value={province}
              onChange={(event) =>
                setProvince(event.target.value)
              }
              className="form-input"
            >
              {provinces.map((item) => (
                <option
                  key={`${item.code}-${item.name}`}
                  value={item.code}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Vị trí trên bản đồ{" "}
              <span className="text-red-600">*</span>
            </p>

            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={isGettingLocation}
              className="w-full rounded-xl bg-slate-800 px-5 py-3 font-bold text-white hover:bg-slate-900 disabled:opacity-60"
            >
              {isGettingLocation
                ? "ĐANG LẤY GPS..."
                : "BẬT GPS"}
            </button>

            <div className="mt-3 rounded-xl bg-slate-100 p-4 text-sm">
              <p
                className={
                  location
                    ? "text-emerald-700"
                    : "text-slate-600"
                }
              >
                {locationMessage}
              </p>

              {location && (
                <div className="mt-2">
                  <p>
                    Vĩ độ:{" "}
                    {location.latitude.toFixed(6)}
                  </p>

                  <p>
                    Kinh độ:{" "}
                    {location.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="surface-card space-y-5 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Thông tin cơ sở
          </h2>

          <FormField label="Vị trí này là" required>
            <select
              value={locationType}
              onChange={(event) =>
                setLocationType(event.target.value)
              }
              className="form-input"
            >
              <option value="Nhà riêng">
                Nhà riêng
              </option>

              <option value="Văn phòng">
                Văn phòng
              </option>

              <option value="Cửa hàng">
                Cửa hàng
              </option>
            </select>
          </FormField>

          <FormField
            label="Số lượng kỹ thuật viên"
            required
          >
            <input
              type="number"
              required
              min="0"
              value={technicianCount}
              onChange={(event) =>
                setTechnicianCount(event.target.value)
              }
              className="form-input"
            />
          </FormField>

          <PhotoInput
            title="Ảnh cửa hàng / mặt tiền"
            required
            photo={photos.store}
            onChange={(event) =>
              handlePhotoChange("store", event)
            }
          />

          <PhotoInput
            title="Ảnh kho hàng / nơi làm việc"
            photo={photos.warehouse}
            onChange={(event) =>
              handlePhotoChange("warehouse", event)
            }
          />

          <FormField label="Video giới thiệu">
            <input
              type="file"
              accept="video/*"
              onChange={(event) =>
                setVideoName(
                  event.target.files?.[0]?.name ?? "",
                )
              }
              className="form-input"
            />

            {videoName && (
              <p className="mt-2 text-sm text-emerald-700">
                Đã chọn: {videoName}
              </p>
            )}
          </FormField>
        </section>

        <section className="surface-card space-y-5 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Năng lực kỹ thuật
          </h2>

          <p className="text-sm text-slate-500">
            Chọn ít nhất một dịch vụ.
          </p>

          <div className="space-y-3">
            {serviceOptions.map((service) => (
              <label
                key={service}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedServices.includes(
                    service,
                  )}
                  onChange={() => toggleService(service)}
                  className="mt-1 h-4 w-4"
                />

                <span className="text-sm font-medium text-slate-700">
                  {service}
                </span>
              </label>
            ))}
          </div>

          <FormField label="Khu vực phục vụ mở rộng">
            <textarea
              value={serviceArea}
              onChange={(event) =>
                setServiceArea(event.target.value)
              }
              placeholder="Ví dụ: Các phường lân cận trong bán kính 20 km"
              rows={3}
              className="form-input resize-none"
            />
          </FormField>
        </section>

        <section className="surface-card space-y-5 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Thông tin tài chính
            </h2>

            <p className="mt-1 text-sm text-red-600">
              Thông tin này được dùng để định danh và thanh toán dịch vụ.
            </p>
          </div>

          <FormField label="Mã số thuế">
            <input
              type="text"
              value={taxCode}
              onChange={(event) =>
                setTaxCode(event.target.value)
              }
              placeholder="Không bắt buộc"
              className="form-input"
            />
          </FormField>

          <FormField label="CCCD" required>
            <input
              type="text"
              required
              value={citizenId}
              onChange={(event) =>
                setCitizenId(
                  event.target.value.replace(/\D/g, ""),
                )
              }
              placeholder="Nhập số CCCD"
              className="form-input"
            />
          </FormField>

          <FormField label="Số tài khoản" required>
            <input
              type="text"
              required
              value={bankAccount}
              onChange={(event) =>
                setBankAccount(
                  event.target.value.replace(/\D/g, ""),
                )
              }
              placeholder="Nhập số tài khoản"
              className="form-input"
            />
          </FormField>

          <FormField label="Chủ tài khoản" required>
            <input
              type="text"
              required
              value={accountHolder}
              onChange={(event) =>
                setAccountHolder(
                  event.target.value.toUpperCase(),
                )
              }
              placeholder="NGUYEN VAN A"
              className="form-input uppercase"
            />
          </FormField>

          <FormField label="Ngân hàng" required>
            <input
              type="text"
              required
              value={bankName}
              onChange={(event) =>
                setBankName(event.target.value)
              }
              placeholder="Nhập tên ngân hàng"
              className="form-input"
            />
          </FormField>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full px-6 py-4 text-lg font-black text-white disabled:opacity-60"
        >
          {submitting ? "ĐANG GỬI HỒ SƠ..." : "GỬI HỒ SƠ ĐĂNG KÝ"}
        </button>

        <div className="text-center">
          <SmartBackButton className="text-sm font-semibold text-slate-500 underline" />
        </div>
      </form>
    </main>
  );
}

type FormFieldProps = {
  label: string;
  required?: boolean;
  children: ReactNode;
};

function FormField({
  label,
  required = false,
  children,
}: FormFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </span>

      {children}
    </label>
  );
}

type PhotoInputProps = {
  title: string;
  required?: boolean;
  photo: PhotoData | null;
  onChange: (
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
};

function PhotoInput({
  title,
  required = false,
  photo,
  onChange,
}: PhotoInputProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">
        {title}

        {required && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </p>

      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-emerald-600 hover:bg-emerald-50">
        <span className="font-bold text-emerald-700">
          CHỤP HOẶC CHỌN ẢNH
        </span>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onChange}
          className="hidden"
        />
      </label>

      {photo && (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <img
            src={photo.preview}
            alt={title}
            className="h-56 w-full object-cover"
          />

          <p className="break-all bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {photo.name}
          </p>
        </div>
      )}
    </div>
  );
}

