"use client";

import { ActionSessionBar } from "@/components/ActionSessionBar";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type MachineStatus =
  | "Hoạt động tốt"
  | "Lỗi nhẹ"
  | "Cần hỗ trợ";

function getTodayString() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function ActivationStepTwoPage() {
  const params = useParams<{ machineId: string }>();
  const machineId = params.machineId;
  const router = useRouter();

  const [installationDate, setInstallationDate] = useState(
    getTodayString(),
  );

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

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => ({ response, result: await response.json() })).then(({ response, result }) => {
      if (!response.ok || !result.success) return;
      setDealerCode(result.user.dealerCode || "");
      setInstallerName(result.user.name || "");
      setInstallerPhone(result.user.phone || "");
      setWorkHome(result.user.role === "KTV" ? "/technician-portal" : "/agent-portal");
    }).catch(() => undefined);
  }, []);

  async function handleSubmit(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  if (installerPhone.length < 9) {
    alert("Số điện thoại người lắp chưa hợp lệ.");
    return;
  }

  try {
    const response = await fetch(
      "/api/activations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      },
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      alert(
        result.message ||
          "Không lưu được kích hoạt bước 2",
      );
      return;
    }

    setCompleted(true);
  } catch (error) {
    console.error(error);

    alert("Có lỗi khi gửi bước 2");
  }
}


  if (completed) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
        <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</div>
          <h1 className="mt-5 text-2xl font-black text-slate-900">Kích hoạt máy thành công</h1>
          <p className="mt-3 text-slate-600">Máy <strong>{machineId}</strong> đã hoàn tất bước 2 và lịch bảo trì đã được tạo.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link href={`/qr/${machineId}`} className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700">Trang QR của máy</Link>
            <button type="button" onClick={() => router.replace(workHome)} className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">Về khu làm việc</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <ActionSessionBar title="Kích hoạt máy · Bước 2" />
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl space-y-6"
      >
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-widest text-green-700">
            KOSOVOTA
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Kích hoạt máy — Bước 2
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Hoàn thiện thông tin lắp đặt và nhận quà.
          </p>

          <div className="mt-5 rounded-xl bg-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              ID máy
            </p>

            <p className="mt-1 break-all font-bold text-slate-900">
              {machineId}
            </p>
          </div>
        </header>

        <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Thông tin lắp đặt
          </h2>

          <FormField
            label="Ngày lắp đặt"
            required
          >
            <input
              type="date"
              required
              value={installationDate}
              onChange={(event) =>
                setInstallationDate(event.target.value)
              }
              className="form-input"
            />
          </FormField>

          <FormField
            label="Mã đại lý"
            required
          >
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
            label="Người lắp đặt"
            required
          >
            <input
              type="text"
              required
              value={installerName}
              readOnly
              placeholder="Tên từ tài khoản đăng nhập"
              className="form-input bg-slate-100"
            />
          </FormField>

          <FormField
            label="Số điện thoại người lắp"
            required
          >
            <input
              type="tel"
              required
              value={installerPhone}
              readOnly
              placeholder="Số điện thoại từ tài khoản đăng nhập"
              className="form-input bg-slate-100"
            />
          </FormField>

          <FormField
            label="Tình trạng máy"
            required
          >
            <select
              value={machineStatus}
              onChange={(event) =>
                setMachineStatus(
                  event.target.value as MachineStatus,
                )
              }
              className="form-input"
            >
              <option value="Hoạt động tốt">
                Hoạt động tốt
              </option>

              <option value="Lỗi nhẹ">
                Lỗi nhẹ
              </option>

              <option value="Cần hỗ trợ">
                Cần hỗ trợ
              </option>
            </select>
          </FormField>

          <FormField label="Lưu ý của chủ nhà">
            <textarea
              value={ownerNote}
              onChange={(event) =>
                setOwnerNote(event.target.value)
              }
              placeholder="Nhập yêu cầu hoặc lưu ý của chủ nhà..."
              rows={5}
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
              Thông tin này chỉ được sử dụng cho quy trình chi trả quà kích hoạt và phải được bảo vệ theo chính sách dữ liệu của KOSOVOTA.
            </p>
          </div>

          <FormField
            label="Số tài khoản nhận quà"
            required
          >
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

          <FormField
            label="Chủ tài khoản"
            required
          >
            <input
              type="text"
              required
              value={accountHolder}
              onChange={(event) =>
                setAccountHolder(
                  event.target.value.toUpperCase(),
                )
              }
              placeholder="Ví dụ: NGUYEN VAN A"
              className="form-input uppercase"
            />
          </FormField>

          <FormField
            label="Ngân hàng"
            required
          >
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/activate/${machineId}/step-1`}
            className="order-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-center font-bold text-slate-700 hover:bg-slate-50 sm:order-1"
          >
            QUAY LẠI BƯỚC 1
          </Link>

          <button
            type="submit"
            className="order-1 rounded-2xl bg-green-600 px-6 py-4 text-lg font-bold text-white shadow-lg hover:bg-green-700 sm:order-2"
          >
            GỬI BƯỚC 2
          </button>
        </div>

        <p className="text-center text-xs text-green-600">
  Dữ liệu sẽ được lưu vào hệ thống KOSOVOTA.
</p>
      </form>
    </main>
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