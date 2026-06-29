"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/ui/Brand";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";

const actions: Array<{
  title: string;
  description: string;
  icon: IconName;
  tone: string;
  href: (machineId: string, hasStepOne: boolean) => string;
}> = [
  {
    title: "Kích hoạt máy",
    description: "Ghi nhận khách hàng, GPS và ảnh lắp đặt.",
    icon: "droplet",
    tone: "action-card--emerald",
    href: (machineId, hasStepOne) => hasStepOne ? `/activate/${machineId}/step-2` : `/activate/${machineId}/step-1`,
  },
  {
    title: "Đăng ký đại lý",
    description: "Đăng ký đại lý hoặc cộng tác viên kỹ thuật.",
    icon: "store",
    tone: "action-card--amber",
    href: () => "/dealer-register",
  },
  {
    title: "Báo cáo dịch vụ",
    description: "Cập nhật thay lõi, sửa chữa và ảnh nghiệm thu.",
    icon: "wrench",
    tone: "action-card--rose",
    href: (machineId) => `/service-report/${machineId}`,
  },
  {
    title: "Máy của tôi",
    description: "Xem bảo hành, lịch sử và kỳ bảo trì tiếp theo.",
    icon: "search",
    tone: "action-card--blue",
    href: (machineId) => `/customer-portal?machineId=${encodeURIComponent(machineId)}`,
  },
];

export default function QrLandingPage() {
  const params = useParams<{ machineId: string }>();
  const machineId = params.machineId;
  const [hasStepOne, setHasStepOne] = useState(false);
  const [checkingActivation, setCheckingActivation] = useState(true);
  const [machine, setMachine] = useState<{ name?: string | null; model: string; capacity?: string | null } | null>(null);
  const [machineError, setMachineError] = useState("");

  const qrImageUrl = `/api/qr/${encodeURIComponent(machineId)}?format=png&size=720`;
  const qrTargetUrl = typeof window === "undefined"
    ? `/qr/${encodeURIComponent(machineId)}`
    : `${window.location.origin}/qr/${encodeURIComponent(machineId)}`;

  async function copyQrLink() {
    try {
      await navigator.clipboard.writeText(qrTargetUrl);
    } catch {
      // Trình duyệt cũ có thể không hỗ trợ Clipboard API.
    }
  }

  useEffect(() => {
    async function checkActivationStepOne() {
      try {
        const [activationResponse, machineResponse] = await Promise.all([
          fetch(`/api/activations?machineId=${encodeURIComponent(machineId)}&step=1`, { cache: "no-store" }),
          fetch(`/api/machines/${encodeURIComponent(machineId)}`, { cache: "no-store" }),
        ]);
        const [activationResult, machineResult] = await Promise.all([activationResponse.json(), machineResponse.json()]);
        setHasStepOne(Boolean(activationResult.success && activationResult.data?.length > 0));
        if (machineResponse.ok && machineResult.success) setMachine(machineResult.data);
        else setMachineError(machineResult.message || "Mã máy chưa có trong hệ thống.");
      } catch {
        setHasStepOne(false);
        setMachineError("Không kiểm tra được mã máy lúc này.");
      } finally {
        setCheckingActivation(false);
      }
    }
    void checkActivationStepOne();
  }, [machineId]);

  return (
    <main className="public-page min-h-screen px-4 py-7 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="surface-card overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
            <div className="p-6 sm:p-9">
              <Brand size="lg" />
              <p className="eyebrow mt-8">Trung tâm dịch vụ QR</p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                Chọn thao tác cho thiết bị
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                Mỗi thao tác được liên kết với đúng mã máy. Dữ liệu khách hàng chỉ hiển thị sau khi xác thực phù hợp.
              </p>
            </div>
            <div className="qr-device-panel p-6 sm:p-9">
              <div className="icon-orb icon-orb--light"><Icon name="qr" size={30} /></div>
              <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-100">ID thiết bị</p>
              <p className="mt-2 break-all text-xl font-extrabold text-white sm:text-2xl">{machineId}</p>
              {machine && <div className="mt-3 rounded-2xl bg-white/10 p-3 text-sm text-emerald-50"><strong className="block text-white">{machine.name || "Thiết bị KOSOVOTA"}</strong><span>{machine.model}{machine.capacity ? ` · ${machine.capacity}` : ""}</span></div>}
              <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-emerald-50">
                <Icon name="shield" size={18} /> Mã định danh KOSOVOTA
              </div>
            </div>
          </div>
        </header>

        {!machineError && !checkingActivation && (
          <section className="surface-card mt-5 p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-[190px_1fr] sm:items-center">
              <div className="mx-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <img src={qrImageUrl} alt={`QR máy ${machineId}`} className="h-40 w-40" />
              </div>
              <div>
                <p className="eyebrow">Tem QR thiết bị</p>
                <h2 className="mt-2 text-xl font-extrabold">Tải hoặc in QR để dán lên máy</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">QR dẫn thẳng tới hồ sơ thiết bị này. Khi chạy thật, hãy đặt <code>NEXT_PUBLIC_APP_URL</code> bằng tên miền HTTPS của hệ thống trước khi in hàng loạt.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={qrImageUrl} download={`KOSOVOTA-${machineId}.png`} className="btn-primary px-4 py-3 font-bold text-white"><Icon name="download" size={18}/> Tải PNG</a>
                  <button type="button" onClick={() => window.print()} className="btn-secondary"><Icon name="file" size={18}/> In trang</button>
                  <button type="button" onClick={() => void copyQrLink()} className="btn-secondary"><Icon name="copy" size={18}/> Sao chép link</button>
                  <Link href="/scan" className="btn-secondary"><Icon name="camera" size={18}/> Mở máy quét</Link>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mt-5 space-y-3">
          {machineError && <Notice kind="error">{machineError}</Notice>}
          {checkingActivation ? (
            <LoadingState label="Đang kiểm tra trạng thái kích hoạt..." />
          ) : hasStepOne ? (
            <Notice kind="info">Bước 1 đã hoàn tất. Nút kích hoạt sẽ đưa anh/chị tới bước bổ sung hồ sơ.</Notice>
          ) : null}
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {actions.map((action) => (
            <Link key={action.title} href={action.href(machineId, hasStepOne)} className={`action-card ${action.tone}`}>
              <span className="action-card__icon"><Icon name={action.icon} size={26} /></span>
              <span className="min-w-0 flex-1">
                <strong className="block text-base font-extrabold text-slate-950 sm:text-lg">{action.title}</strong>
                <span className="mt-1 block text-sm leading-6 text-slate-600">{action.description}</span>
              </span>
              <Icon name="chevron-right" className="shrink-0 text-slate-400" />
            </Link>
          ))}
        </section>

        <div className="mt-7 flex justify-center">
          <Link href="/" className="btn-secondary"><Icon name="home" size={18} /> Về trang sản phẩm</Link>
        </div>
      </div>
    </main>
  );
}
