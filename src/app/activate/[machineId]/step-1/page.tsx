"use client";

import { ActionSessionBar } from "@/components/ActionSessionBar";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";
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
      .catch(() => setMachineInformation({ name: "Thiết bị KOSOVOTA", model: "Chưa xác định", productionDate: "Chưa cập nhật" }));
  }, [machineId]);

  const [mode, setMode] = useState<"normal" | "quick">("normal");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  const [location, setLocation] =
    useState<LocationData | null>(null);

  const [locationMessage, setLocationMessage] = useState(
    "Chưa lấy vị trí GPS",
  );

  const [isGettingLocation, setIsGettingLocation] =
    useState(false);

  const [photos, setPhotos] = useState<
    Record<PhotoKey, PhotoData | null>
  >({
    building: null,
    machine: null,
    summary: null,
  });

  function getCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage(
        "Trình duyệt này không hỗ trợ GPS.",
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

  async function submitStepOne(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!location) {
    alert("Anh/chị cần bấm BẬT GPS trước khi gửi.");
    return;
  }

  if (mode === "normal") {
    if (!photos.building || !photos.machine) {
      alert("Chế độ bình thường yêu cầu ảnh mặt tiền và ảnh vị trí máy.");
      return;
    }
  }

  if (mode === "quick" && !photos.summary) {
    alert("Chế độ cực nhanh yêu cầu ảnh tóm tắt.");
    return;
  }

  try {
    const buildingPhoto = await uploadPhoto(photos.building);
    const machinePhoto = await uploadPhoto(photos.machine);
    const summaryPhoto = await uploadPhoto(photos.summary);

    const response = await fetch("/api/activations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        step: 1,
        machineId,
        mode,
        ownerName,
        ownerPhone,
        location,
        photos: {
          building: buildingPhoto,
          machine: machinePhoto,
          summary: summaryPhoto,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      alert(result.message || "Không lưu được kích hoạt bước 1.");
      return;
    }

    alert("Đã lưu thông tin kích hoạt bước 1 vào database.");

    router.push(`/activate/${machineId}/step-2`);
  } catch (error) {
    console.error(error);
    alert("Có lỗi khi gửi kích hoạt bước 1.");
  }
}

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <ActionSessionBar title="Kích hoạt máy · Bước 1" />
      <form
        onSubmit={submitStepOne}
        className="mx-auto max-w-2xl space-y-6"
      >
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-widest text-green-700">
            KOSOVOTA
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Kích hoạt máy — Bước 1
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Nhập thông tin tại vị trí lắp đặt máy.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Thông tin máy
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b pb-3">
              <dt className="text-slate-500">ID máy</dt>
              <dd className="font-bold text-slate-900">
                {machineId}
              </dd>
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
          <h2 className="font-bold text-slate-900">
            Chế độ nhập liệu
          </h2>

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

              <span className="font-semibold">
                Chế độ bình thường
              </span>

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

              <span className="font-semibold">
                Chế độ cực nhanh
              </span>

              <p className="mt-1 text-xs text-slate-500">
                Chỉ cần chụp một ảnh tóm tắt.
              </p>
            </label>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">
            Vị trí lắp đặt
          </h2>

          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={isGettingLocation}
            className="mt-4 w-full rounded-xl bg-slate-800 px-5 py-3 font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGettingLocation
              ? "ĐANG LẤY GPS..."
              : "BẬT GPS"}
          </button>

          <div className="mt-4 rounded-xl bg-slate-100 p-4 text-sm">
            <p
              className={
                location ? "text-green-700" : "text-slate-600"
              }
            >
              {locationMessage}
            </p>

            {location && (
              <div className="mt-3 space-y-1">
                <p>
                  Vĩ độ:{" "}
                  <strong>
                    {location.latitude.toFixed(6)}
                  </strong>
                </p>

                <p>
                  Kinh độ:{" "}
                  <strong>
                    {location.longitude.toFixed(6)}
                  </strong>
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
          <h2 className="font-bold text-slate-900">
            Thông tin chủ nhà
          </h2>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Tên chủ nhà <span className="text-red-600">*</span>
            </span>

            <input
              type="text"
              required
              value={ownerName}
              onChange={(event) =>
                setOwnerName(event.target.value)
              }
              placeholder="Ví dụ: Nguyễn Văn A"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Số điện thoại chủ nhà{" "}
              <span className="text-red-600">*</span>
            </span>

            <input
              type="tel"
              required
              value={ownerPhone}
              onChange={(event) =>
                setOwnerPhone(event.target.value)
              }
              placeholder="Ví dụ: 0912345678"
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
              onChange={(event) =>
                handlePhotoChange("building", event)
              }
            />

            <PhotoInput
              title="Ảnh vị trí máy"
              description="Chụp rõ vị trí đặt máy trong nhà."
              photo={photos.machine}
              onChange={(event) =>
                handlePhotoChange("machine", event)
              }
            />
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <PhotoInput
              title="Ảnh tóm tắt"
              description="Chụp một ảnh thể hiện máy và vị trí lắp đặt."
              photo={photos.summary}
              onChange={(event) =>
                handlePhotoChange("summary", event)
              }
            />
          </section>
        )}

        <button
          type="submit"
          className="w-full rounded-2xl bg-green-600 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-green-700"
        >
          GỬI BƯỚC 1
        </button>

        <p className="text-center text-xs text-slate-400">
          Dữ liệu kích hoạt được lưu an toàn trong
          trình duyệt.
        </p>
      </form>
    </main>
  );
}

type PhotoInputProps = {
  title: string;
  description: string;
  photo: PhotoData | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function PhotoInput({
  title,
  description,
  photo,
  onChange,
}: PhotoInputProps) {
  return (
    <div>
      <h3 className="font-bold text-slate-900">
        {title} <span className="text-red-600">*</span>
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>

      <label className="mt-3 block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-green-600 hover:bg-green-50">
        <span className="font-bold text-green-700">
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