"use client";

import { ActionSessionBar } from "@/components/ActionSessionBar";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { findProductByModel } from "@/data/products";
import { Brand } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";

type PhotoKey = "oldFilter" | "newFilter" | "completedMachine";

type PhotoData = {
  name: string;
  preview: string;
  file: File;
};

type ServiceType =
  | "Thay lõi số 1"
  | "Thay lõi 1,2,3"
  | "Thay màng RO"
  | "Sửa chữa"
  | "Thay toàn bộ lõi";

export default function ServiceReportPage() {
  const params = useParams<{ machineId: string }>();
  const machineId = params.machineId;
  const [machineInformation, setMachineInformation] = useState({
    name: "Thiết bị KOSOVOTA",
    serial: "Chưa cập nhật",
    installationDate: "Chưa cập nhật",
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const [dealerCode, setDealerCode] = useState("");
  const [serviceType, setServiceType] =
    useState<ServiceType>("Thay lõi số 1");

  const [replacementProducts, setReplacementProducts] =
    useState("");

  const [ownerNote, setOwnerNote] = useState("");

  const [photos, setPhotos] = useState<
    Record<PhotoKey, PhotoData | null>
  >({
    oldFilter: null,
    newFilter: null,
    completedMachine: null,
  });

  const [signatureDrawn, setSignatureDrawn] =
    useState(false);

  const [signatureUpload, setSignatureUpload] =
    useState<PhotoData | null>(null);

  const [generatedReportId, setGeneratedReportId] =
    useState<string | null>(null);

  function prepareSignatureCanvas() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "#0f172a";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
  }

  useEffect(() => {
    prepareSignatureCanvas();
    fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => ({ response, result: await response.json() })).then(({ response, result }) => {
      if (response.ok && result.success) setDealerCode(result.user.dealerCode || "");
    }).catch(() => undefined);
    fetch(`/api/machines/${machineId}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message);
        setMachineInformation({
          name: findProductByModel(result.data.model).name,
          serial: result.data.serial || "Chưa cập nhật",
          installationDate: result.data.installDate
            ? new Date(result.data.installDate).toLocaleDateString("vi-VN")
            : "Chưa cập nhật",
        });
      })
      .catch(() => undefined);
  }, [machineId]);

  function getCanvasPosition(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    const canvas = event.currentTarget;
    const rectangle = canvas.getBoundingClientRect();

    const x =
      ((event.clientX - rectangle.left) /
        rectangle.width) *
      canvas.width;

    const y =
      ((event.clientY - rectangle.top) /
        rectangle.height) *
      canvas.height;

    return { x, y };
  }

  function startDrawing(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    const { x, y } = getCanvasPosition(event);

    context.beginPath();
    context.moveTo(x, y);

    isDrawingRef.current = true;
    setSignatureDrawn(true);
  }

  function drawSignature(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    if (!isDrawingRef.current) {
      return;
    }

    const context =
      event.currentTarget.getContext("2d");

    if (!context) {
      return;
    }

    event.preventDefault();

    const { x, y } = getCanvasPosition(event);

    context.lineTo(x, y);
    context.stroke();
  }

  function stopDrawing(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    if (!isDrawingRef.current) {
      return;
    }

    isDrawingRef.current = false;

    const context =
      event.currentTarget.getContext("2d");

    context?.closePath();

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    context.fillStyle = "#ffffff";
    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    context.strokeStyle = "#0f172a";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";

    setSignatureDrawn(false);
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

  function handleSignatureUpload(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSignatureUpload({
      name: file.name,
      preview: URL.createObjectURL(file),
      file,
    });
  }

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

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

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!photos.oldFilter) {
    alert("Anh/chị cần chụp ảnh lõi cũ.");
    return;
  }

  if (!photos.newFilter) {
    alert("Anh/chị cần chụp ảnh lõi mới.");
    return;
  }

  if (!signatureDrawn && !signatureUpload) {
    alert("Khách hàng cần ký trực tiếp hoặc tải ảnh chữ ký.");
    return;
  }

  try {
    const oldCorePhoto = await uploadFile(photos.oldFilter.file);
    const newCorePhoto = await uploadFile(photos.newFilter.file);

    const finalPhoto = photos.completedMachine
      ? await uploadFile(photos.completedMachine.file)
      : null;

    let signature = "";

    if (signatureUpload) {
      signature = await uploadFile(signatureUpload.file);
    } else {
      signature = canvasRef.current?.toDataURL("image/png") ?? "";
    }

    const response = await fetch("/api/service-reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        machineId,
        dealerCode,
        serviceType,
        products: replacementProducts,
        oldCorePhoto,
        newCorePhoto,
        finalPhoto,
        signature,
        note: ownerNote,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không gửi được báo cáo dịch vụ");
    }

    setGeneratedReportId(result.data.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  } catch (error) {
    console.error(error);
    alert("Không gửi được báo cáo. Vui lòng thử lại.");
  }
}

  if (generatedReportId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg">
          <div className="icon-orb mx-auto"><Icon name="check" size={30} /></div>

          <div className="mt-6 flex justify-center"><Brand compact /></div>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Đã gửi báo cáo dịch vụ
          </h1>

          <p className="mt-4 text-slate-600">
            Cảm ơn anh/chị đã cập nhật. KOSOVOTA
            sẽ thanh toán trong 1–2 ngày làm việc.
          </p>

          <div className="mt-6 rounded-2xl bg-slate-100 p-5">
            <p className="text-xs uppercase text-slate-500">
              Mã báo cáo
            </p>

            <p className="mt-1 text-xl font-bold text-green-700">
              {generatedReportId}
            </p>

            <p className="mt-4 text-xs uppercase text-slate-500">
              ID máy
            </p>

            <p className="mt-1 break-all font-bold text-slate-800">
              {machineId}
            </p>
          </div>

          <div className="mt-7 space-y-3">
            <Link
              href={`/qr/${machineId}`}
              className="block rounded-xl bg-green-600 px-5 py-4 font-bold text-white hover:bg-green-700"
            >
              QUAY VỀ TRANG QR
            </Link>

            <button
              type="button"
              onClick={() => {
                setGeneratedReportId(null);
                setReplacementProducts("");
                setOwnerNote("");
                setPhotos({ oldFilter: null, newFilter: null, completedMachine: null });
                setSignatureUpload(null);
                setSignatureDrawn(false);
                requestAnimationFrame(prepareSignatureCanvas);
              }}
              className="w-full rounded-xl border border-slate-300 px-5 py-4 font-bold text-slate-700 hover:bg-slate-50"
            >
              TẠO BÁO CÁO KHÁC
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <ActionSessionBar title="Báo cáo dịch vụ" />
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl space-y-6"
      >
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-widest text-green-700">
            KOSOVOTA
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Báo cáo dịch vụ
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Ghi nhận việc thay lõi, sửa chữa hoặc
            bảo trì máy.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Thông tin máy
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            <InformationRow
              label="ID máy"
              value={machineId}
            />

            <InformationRow
              label="Tên máy"
              value={machineInformation.name}
            />

            <InformationRow
              label="Số Seri"
              value={machineInformation.serial}
            />

            <InformationRow
              label="Ngày lắp đặt"
              value={
                machineInformation.installationDate
              }
              last
            />
          </dl>
        </section>

        <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Nội dung dịch vụ
          </h2>

          <FormField label="Mã đại lý" required>
            <input
              type="text"
              required
              value={dealerCode}
              readOnly
              placeholder="Mã đại lý từ tài khoản đăng nhập"
              className="form-input uppercase bg-slate-100"
            />
          </FormField>

          <FormField
            label="Dịch vụ thực hiện"
            required
          >
            <select
              value={serviceType}
              onChange={(event) =>
                setServiceType(
                  event.target.value as ServiceType,
                )
              }
              className="form-input"
            >
              <option value="Thay lõi số 1">
                Thay lõi số 1
              </option>

              <option value="Thay lõi 1,2,3">
                Thay lõi 1,2,3
              </option>

              <option value="Thay màng RO">
                Thay màng RO
              </option>

              <option value="Sửa chữa">
                Sửa chữa
              </option>

              <option value="Thay toàn bộ lõi">
                Thay toàn bộ lõi
              </option>
            </select>
          </FormField>

          <FormField
            label="Sản phẩm thay thế"
            required
          >
            <textarea
              required
              value={replacementProducts}
              onChange={(event) =>
                setReplacementProducts(
                  event.target.value,
                )
              }
              placeholder="Ví dụ: Lõi số 1, lõi than hoạt tính"
              rows={4}
              className="form-input resize-none"
            />
          </FormField>
        </section>

        <section className="space-y-7 rounded-2xl bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Ảnh báo cáo
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Ảnh lõi cũ và lõi mới là bắt buộc.
            </p>
          </div>

          <PhotoInput
            title="Ảnh lõi cũ đã tháo ra"
            description="Chụp lõi cũ đặt cạnh máy và thấy rõ logo KOSOVOTA."
            required
            photo={photos.oldFilter}
            onChange={(event) =>
              handlePhotoChange(
                "oldFilter",
                event,
              )
            }
          />

          <PhotoInput
            title="Ảnh lõi mới sắp thay vào"
            description="Chụp lõi mới đặt cạnh máy và thấy rõ logo KOSOVOTA."
            required
            photo={photos.newFilter}
            onChange={(event) =>
              handlePhotoChange(
                "newFilter",
                event,
              )
            }
          />

          <PhotoInput
            title="Ảnh toàn cảnh máy sau khi hoàn thành"
            description="Không bắt buộc nhưng được khuyến khích."
            photo={photos.completedMachine}
            onChange={(event) =>
              handlePhotoChange(
                "completedMachine",
                event,
              )
            }
          />
        </section>

        <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Chữ ký khách hàng{" "}
              <span className="text-red-600">*</span>
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Khách hàng ký bằng chuột, ngón tay
              hoặc tải ảnh chữ ký.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white">
            <canvas
              ref={canvasRef}
              width={700}
              height={280}
              onPointerDown={startDrawing}
              onPointerMove={drawSignature}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onPointerLeave={stopDrawing}
              className="h-48 w-full touch-none cursor-crosshair bg-white"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {signatureDrawn
                ? "Đã có chữ ký trực tiếp."
                : "Chưa có chữ ký trực tiếp."}
            </p>

            <button
              type="button"
              onClick={clearSignature}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
            >
              XÓA CHỮ KÝ
            </button>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <p className="mb-3 text-center text-sm font-bold text-slate-500">
              HOẶC
            </p>

            <label className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-green-600 hover:bg-green-50">
              <span className="font-bold text-green-700">
                TẢI ẢNH CHỮ KÝ
              </span>

              <input
                type="file"
                accept="image/*"
                onChange={handleSignatureUpload}
                className="hidden"
              />
            </label>

            {signatureUpload && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <img
                  src={signatureUpload.preview}
                  alt="Ảnh chữ ký khách hàng"
                  className="h-48 w-full bg-white object-contain"
                />

                <div className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2">
                  <p className="break-all text-xs text-slate-500">
                    {signatureUpload.name}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setSignatureUpload(null)
                    }
                    className="shrink-0 text-xs font-bold text-red-600"
                  >
                    XÓA
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <FormField label="Lưu ý của chủ nhà">
            <textarea
              value={ownerNote}
              onChange={(event) =>
                setOwnerNote(event.target.value)
              }
              placeholder="Nhập phản hồi hoặc lưu ý của khách hàng..."
              rows={5}
              className="form-input resize-none"
            />
          </FormField>
        </section>

        <button
          type="submit"
          className="w-full rounded-2xl bg-green-600 px-6 py-4 text-lg font-bold text-white shadow-lg hover:bg-green-700"
        >
          GỬI BÁO CÁO
        </button>

        <Link
          href={`/qr/${machineId}`}
          className="block text-center text-sm font-semibold text-slate-500 underline"
        >
          Quay về trang QR
        </Link>

        <p className="text-center text-xs text-slate-400">
          Báo cáo sẽ được lưu vào hệ thống KOSOVOTA.
        </p>
      </form>
    </main>
  );
}

type InformationRowProps = {
  label: string;
  value: string;
  last?: boolean;
};

function InformationRow({
  label,
  value,
  last = false,
}: InformationRowProps) {
  return (
    <div
      className={`flex justify-between gap-4 ${
        last ? "" : "border-b pb-3"
      }`}
    >
      <dt className="text-slate-500">
        {label}
      </dt>

      <dd className="text-right font-bold text-slate-900">
        {value}
      </dd>
    </div>
  );
}

type FormFieldProps = {
  label: string;
  required?: boolean;
  children: React.ReactNode;
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
  description: string;
  required?: boolean;
  photo: PhotoData | null;
  onChange: (
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
};

function PhotoInput({
  title,
  description,
  required = false,
  photo,
  onChange,
}: PhotoInputProps) {
  return (
    <div>
      <h3 className="font-bold text-slate-900">
        {title}

        {required && (
          <span className="ml-1 text-red-600">*</span>
        )}
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