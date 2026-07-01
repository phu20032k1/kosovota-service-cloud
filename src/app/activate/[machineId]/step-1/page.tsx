"use client";

import { ActionSessionBar } from "@/components/ActionSessionBar";

import Link from "next/link";
import { ChangeEvent, FormEvent, ReactNode, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { findProductByModel } from "@/data/products";

type LocationData = {
  latitude: number;
  longitude: number;
};

type PhotoData = {
  name: string;
  preview: string;
  file: File;
};

type PhotoKey = "building" | "machine" | "summary";

type MachineStatus = "Hoạt động tốt" | "Lỗi nhẹ" | "Cần hỗ trợ";

function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ActivationStepOnePage() {
  const router = useRouter();
  const params = useParams<{ machineId: string }>();

  const machineId = params.machineId;
  const [machineInformation, setMachineInformation] = useState({
    name: "Thiết bị KOSOVOTA",
    model: "Đang tải...",
    productionDate: "Chưa cập nhật",
  });

  useEffect(() => {
    fetch(`/api/machines/${machineId}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message);
        const product = findProductByModel(result.data.model);
        setMachineInformation({
          name: product.name,
          model: result.data.model,
          productionDate: result.data.manufactureDate
            ? new Date(result.data.manufactureDate).toLocaleDateString("vi-VN")
            : "Chưa cập nhật",
        });
      })
      .catch(() =>
        setMachineInformation({
          name: "Thiết bị KOSOVOTA",
          model: "Chưa xác định",
          productionDate: "Chưa cập nhật",
        }),
      );
  }, [machineId]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (!response.ok || !result.success) return;
        setDealerCode(result.user.dealerCode || "");
        setInstallerName(result.user.name || "");
        setInstallerPhone(result.user.phone || "");
        const role = String(result.user.role || "").toUpperCase();
        if (role === "ADMIN" || role === "SUPER_ADMIN")
          setWorkHome("/admin/reports");
        else if (role === "KTV") setWorkHome("/technician-portal");
        else if (role === "CSKH") setWorkHome("/cskh/tickets");
        else setWorkHome("/agent-portal");
      })
      .catch(() => undefined);
  }, []);

  const [mode, setMode] = useState<"normal" | "quick">("normal");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [allowTestMode, setAllowTestMode] = useState(false);
  const [installationDate, setInstallationDate] = useState(getTodayString());
  const [dealerCode, setDealerCode] = useState("");
  const [installerName, setInstallerName] = useState("");
  const [installerPhone, setInstallerPhone] = useState("");
  const [machineStatus, setMachineStatus] =
    useState<MachineStatus>("Hoạt động tốt");
  const [ownerNote, setOwnerNote] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [completed, setCompleted] = useState(false);
  const [workHome, setWorkHome] = useState("/agent-portal");

  const [location, setLocation] = useState<LocationData | null>(null);

  const [locationMessage, setLocationMessage] = useState("Chưa lấy vị trí GPS");

  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [photos, setPhotos] = useState<Record<PhotoKey, PhotoData | null>>({
    building: null,
    machine: null,
    summary: null,
  });

  function getCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Trình duyệt này không hỗ trợ GPS.");
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
      (error) => {
        console.error(error);

        setLocationMessage(
          "Không lấy được vị trí. Hãy cho phép trình duyệt truy cập vị trí.",
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

    const preview = URL.createObjectURL(file);

    setPhotos((currentPhotos) => ({
      ...currentPhotos,
      [key]: {
        name: file.name,
        preview,
        file,
      },
    }));
  }

  async function uploadPhoto(photo: PhotoData | null) {
    if (!photo) {
      return null;
    }

    const formData = new FormData();
    formData.append("file", photo.file);

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

  async function submitActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!location && !allowTestMode) {
      alert(
        "Anh/chị cần bấm BẬT GPS trước khi gửi. Nếu đang test trên máy tính, bật Chế độ test.",
      );
      return;
    }

    if (!allowTestMode) {
      if (mode === "normal" && (!photos.building || !photos.machine)) {
        alert("Chế độ bình thường yêu cầu ảnh mặt tiền và ảnh vị trí máy.");
        return;
      }

      if (mode === "quick" && !photos.summary) {
        alert("Chế độ cực nhanh yêu cầu ảnh tóm tắt.");
        return;
      }
    }

    if (installerPhone && installerPhone.length < 9) {
      alert("Số điện thoại người lắp chưa hợp lệ.");
      return;
    }

    try {
      const buildingPhoto = await uploadPhoto(photos.building);
      const machinePhoto = await uploadPhoto(photos.machine);
      const summaryPhoto = await uploadPhoto(photos.summary);

      const stepOneResponse = await fetch("/api/activations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 1,
          machineId,
          mode,
          ownerName,
          ownerPhone,
          address,
          location: location || { latitude: 21.0278, longitude: 105.8342 },
          note: allowTestMode ? "Kích hoạt bằng chế độ test" : undefined,
          photos: {
            building: buildingPhoto,
            machine: machinePhoto,
            summary: summaryPhoto,
          },
        }),
      });

      const stepOneResult = await stepOneResponse.json();
      if (!stepOneResponse.ok || !stepOneResult.success) {
        alert(
          stepOneResult.message ||
            "Không lưu được thông tin khách hàng/lắp đặt.",
        );
        return;
      }

      const stepTwoResponse = await fetch("/api/activations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 2,
          machineId,
          installationDate,
          dealerCode,
          installerName,
          installerPhone,
          machineStatus,
          ownerNote,
          bankAccount,
          accountHolder,
          bankName,
        }),
      });

      const stepTwoResult = await stepTwoResponse.json();
      if (!stepTwoResponse.ok || !stepTwoResult.success) {
        alert(
          stepTwoResult.message ||
            "Đã lưu thông tin khách hàng nhưng chưa lưu được phần hoàn tất kích hoạt.",
        );
        return;
      }

      setCompleted(true);
    } catch (error) {
      console.error(error);
      alert("Có lỗi khi gửi kích hoạt máy.");
    }
  }

  if (completed) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
        <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
            ✓
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-900">
            Kích hoạt máy thành công
          </h1>
          <p className="mt-3 text-slate-600">
            Máy <strong>{machineId}</strong> đã lưu đủ thông tin khách hàng, lắp
            đặt và bảo trì.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link
              href={`/qr/${machineId}`}
              className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700"
            >
              Trang QR của máy
            </Link>
            <button
              type="button"
              onClick={() => router.replace(workHome)}
              className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white"
            >
              Về khu làm việc
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <ActionSessionBar title="Kích hoạt máy" />
      <form onSubmit={submitActivation} className="mx-auto max-w-2xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-widest text-green-700">
            KOSOVOTA
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Kích hoạt máy
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Nhập đủ thông tin khách hàng, vị trí, ảnh, người lắp và hoàn tất
            kích hoạt trên cùng một màn hình.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Thông tin máy</h2>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b pb-3">
              <dt className="text-slate-500">ID máy</dt>
              <dd className="font-bold text-slate-900">{machineId}</dd>
            </div>

            <div className="flex justify-between gap-4 border-b pb-3">
              <dt className="text-slate-500">Tên máy</dt>
              <dd className="text-right font-medium text-slate-900">
                {machineInformation.name}
              </dd>
            </div>

            <div className="flex justify-between gap-4 border-b pb-3">
              <dt className="text-slate-500">Model</dt>
              <dd className="font-medium text-slate-900">
                {machineInformation.model}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Ngày sản xuất</dt>
              <dd className="font-medium text-slate-900">
                {machineInformation.productionDate}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Chế độ nhập liệu</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border p-4 ${
                mode === "normal"
                  ? "border-green-600 bg-green-50"
                  : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="activationMode"
                value="normal"
                checked={mode === "normal"}
                onChange={() => setMode("normal")}
                className="mr-2"
              />

              <span className="font-semibold">Chế độ bình thường</span>

              <p className="mt-1 text-xs text-slate-500">
                Chụp ảnh mặt tiền và vị trí máy.
              </p>
            </label>

            <label
              className={`cursor-pointer rounded-xl border p-4 ${
                mode === "quick"
                  ? "border-orange-500 bg-orange-50"
                  : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="activationMode"
                value="quick"
                checked={mode === "quick"}
                onChange={() => setMode("quick")}
                className="mr-2"
              />

              <span className="font-semibold">Chế độ cực nhanh</span>

              <p className="mt-1 text-xs text-slate-500">
                Chỉ cần chụp một ảnh tóm tắt.
              </p>
            </label>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Vị trí lắp đặt</h2>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={allowTestMode}
              onChange={(event) => setAllowTestMode(event.target.checked)}
              className="mt-1"
            />
            <span>
              <strong>Chế độ test trên máy tính:</strong> cho phép gửi bước 1
              không cần ảnh/GPS thật, dùng tọa độ mẫu Hà Nội để test admin, báo
              cáo và bản đồ.
            </span>
          </label>

          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={isGettingLocation}
            className="mt-4 w-full rounded-xl bg-slate-800 px-5 py-3 font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGettingLocation ? "ĐANG LẤY GPS..." : "BẬT GPS"}
          </button>

          <div className="mt-4 rounded-xl bg-slate-100 p-4 text-sm">
            <p className={location ? "text-green-700" : "text-slate-600"}>
              {locationMessage}
            </p>

            {location && (
              <div className="mt-3 space-y-1">
                <p>
                  Vĩ độ: <strong>{location.latitude.toFixed(6)}</strong>
                </p>

                <p>
                  Kinh độ: <strong>{location.longitude.toFixed(6)}</strong>
                </p>

                <a
                  href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block pt-2 font-semibold text-blue-600 underline"
                >
                  Mở vị trí trên bản đồ
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Thông tin chủ nhà</h2>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Tên chủ nhà <span className="text-red-600">*</span>
            </span>

            <input
              type="text"
              required
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder="Ví dụ: Nguyễn Văn A"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Số điện thoại chủ nhà <span className="text-red-600">*</span>
            </span>

            <input
              type="tel"
              required
              value={ownerPhone}
              onChange={(event) => setOwnerPhone(event.target.value)}
              placeholder="Ví dụ: 0912345678"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Địa chỉ lắp đặt
            </span>
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Ví dụ: Số 1, phường..., Hà Nội"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </label>
        </section>

        {mode === "normal" ? (
          <section className="space-y-6 rounded-2xl bg-white p-5 shadow-sm">
            <PhotoInput
              title="Ảnh tòa nhà / mặt tiền"
              description="Chụp từ ngoài nhìn vào, thấy số nhà hoặc đặc điểm nhận dạng."
              photo={photos.building}
              onChange={(event) => handlePhotoChange("building", event)}
            />

            <PhotoInput
              title="Ảnh vị trí máy"
              description="Chụp rõ vị trí đặt máy trong nhà."
              photo={photos.machine}
              onChange={(event) => handlePhotoChange("machine", event)}
            />
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <PhotoInput
              title="Ảnh tóm tắt"
              description="Chụp một ảnh thể hiện máy và vị trí lắp đặt."
              photo={photos.summary}
              onChange={(event) => handlePhotoChange("summary", event)}
            />
          </section>
        )}

        <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Thông tin lắp đặt & hoàn tất
          </h2>

          <FormField label="Ngày lắp đặt" required>
            <input
              type="date"
              required
              value={installationDate}
              onChange={(event) => setInstallationDate(event.target.value)}
              className="form-input"
            />
          </FormField>

          <FormField label="Mã đại lý">
            <input
              type="text"
              value={dealerCode}
              onChange={(event) => setDealerCode(event.target.value)}
              placeholder="Mã đại lý hoặc mã khu vực"
              className="form-input uppercase"
            />
          </FormField>

          <FormField label="Người lắp đặt" required>
            <input
              type="text"
              required
              value={installerName}
              onChange={(event) => setInstallerName(event.target.value)}
              placeholder="Tên KTV/đại lý lắp đặt"
              className="form-input"
            />
          </FormField>

          <FormField label="Số điện thoại người lắp" required>
            <input
              type="tel"
              required
              value={installerPhone}
              onChange={(event) => setInstallerPhone(event.target.value)}
              placeholder="SĐT KTV/đại lý"
              className="form-input"
            />
          </FormField>

          <FormField label="Tình trạng máy" required>
            <select
              value={machineStatus}
              onChange={(event) =>
                setMachineStatus(event.target.value as MachineStatus)
              }
              className="form-input"
            >
              <option value="Hoạt động tốt">Hoạt động tốt</option>
              <option value="Lỗi nhẹ">Lỗi nhẹ</option>
              <option value="Cần hỗ trợ">Cần hỗ trợ</option>
            </select>
          </FormField>

          <FormField label="Lưu ý của chủ nhà">
            <textarea
              value={ownerNote}
              onChange={(event) => setOwnerNote(event.target.value)}
              placeholder="Nhập yêu cầu hoặc lưu ý của chủ nhà..."
              rows={4}
              className="form-input resize-none"
            />
          </FormField>
        </section>

        <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Thông tin nhận quà
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Có thể nhập ngay tại đây, không cần sang bước 2 riêng.
            </p>
          </div>

          <FormField label="Số tài khoản nhận quà">
            <input
              type="text"
              value={bankAccount}
              onChange={(event) =>
                setBankAccount(event.target.value.replace(/\D/g, ""))
              }
              placeholder="Nhập số tài khoản"
              className="form-input"
            />
          </FormField>

          <FormField label="Chủ tài khoản">
            <input
              type="text"
              value={accountHolder}
              onChange={(event) =>
                setAccountHolder(event.target.value.toUpperCase())
              }
              placeholder="Ví dụ: NGUYEN VAN A"
              className="form-input uppercase"
            />
          </FormField>

          <FormField label="Ngân hàng">
            <input
              type="text"
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              placeholder="Nhập tên ngân hàng"
              className="form-input"
            />
          </FormField>
        </section>

        <button
          type="submit"
          className="w-full rounded-2xl bg-green-600 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-green-700"
        >
          LƯU VÀ KÍCH HOẠT MÁY
        </button>

        <p className="text-center text-xs text-slate-400">
          Dữ liệu kích hoạt được lưu vào hệ thống KOSOVOTA.
        </p>
      </form>
    </main>
  );
}

type FormFieldProps = {
  label: string;
  required?: boolean;
  children: ReactNode;
};

function FormField({ label, required = false, children }: FormFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

type PhotoInputProps = {
  title: string;
  description: string;
  photo: PhotoData | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function PhotoInput({ title, description, photo, onChange }: PhotoInputProps) {
  return (
    <div>
      <h3 className="font-bold text-slate-900">
        {title} <span className="text-red-600">*</span>
      </h3>

      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <label className="mt-3 block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-green-600 hover:bg-green-50">
        <span className="font-bold text-green-700">CHỤP HOẶC CHỌN ẢNH</span>

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
