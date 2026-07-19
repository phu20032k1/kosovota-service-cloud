"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/ui/Brand";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { SmartBackButton } from "@/components/ui/SmartBackButton";

type ActionItem = {
  title: string;
  description: string;
  icon: IconName;
  tone: string;
  href: string;
};

type CurrentUser = {
  name?: string | null;
  role?: string | null;
  dealerCode?: string | null;
};

type MachineSummary = {
  name?: string | null;
  model: string;
  capacity?: string | null;
  status?: string | null;
  customerId?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  activatedAt?: string | null;
  installationDate?: string | null;
};

function isStaffRole(role?: string | null) {
  const normalizedRole = String(role || "").toUpperCase();
  return ["ADMIN", "SUPER_ADMIN", "KTV", "DEALER", "CTV", "CSKH"].includes(
    normalizedRole,
  );
}

function getWorkHome(role?: string | null) {
  const normalizedRole = String(role || "").toUpperCase();
  if (normalizedRole === "ADMIN" || normalizedRole === "SUPER_ADMIN")
    return "/admin/reports";
  if (normalizedRole === "KTV") return "/technician-portal";
  if (normalizedRole === "DEALER" || normalizedRole === "CTV") return "/agent-portal";
  if (normalizedRole === "CSKH") return "/cskh/tickets";
  return "/";
}

function getAdminDetailHref(machineId: string, role?: string | null) {
  const normalizedRole = String(role || "").toUpperCase();
  if (normalizedRole === "ADMIN" || normalizedRole === "SUPER_ADMIN") {
    return `/admin/machines/${encodeURIComponent(machineId)}`;
  }
  return `/machine/${encodeURIComponent(machineId)}`;
}

export default function QrLandingPage() {
  const params = useParams<{ machineId: string }>();
  const machineId = params.machineId;
  const [hasStepOne, setHasStepOne] = useState(false);
  const [checkingActivation, setCheckingActivation] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [machine, setMachine] = useState<MachineSummary | null>(null);
  const [machineError, setMachineError] = useState("");

  const qrImageUrl = `/api/qr/${encodeURIComponent(machineId)}?format=png&size=720`;
  const qrTargetUrl =
    typeof window === "undefined"
      ? `/qr/${encodeURIComponent(machineId)}`
      : `${window.location.origin}/qr/${encodeURIComponent(machineId)}`;

  const isStaff = isStaffRole(currentUser?.role);
  const isActivated = Boolean(
    hasStepOne ||
    machine?.customerId ||
    machine?.ownerPhone ||
    machine?.activatedAt ||
    machine?.installationDate ||
    String(machine?.status || "")
      .toUpperCase()
      .includes("ACTIV"),
  );

  const actions = useMemo<ActionItem[]>(() => {
    if (isStaff) {
      return [
        {
          title: "Kích hoạt / cập nhật máy",
          description:
            "Nhập khách hàng, GPS, ảnh, người lắp, ngày lắp và quà trên cùng một màn hình.",
          icon: "droplet",
          tone: "action-card--emerald",
          href: `/activate/${encodeURIComponent(machineId)}/step-1`,
        },
        {
          title: "Báo cáo dịch vụ",
          description: "Ghi nhận thay lõi, sửa chữa, ảnh nghiệm thu.",
          icon: "wrench",
          tone: "action-card--rose",
          href: `/service-report/${encodeURIComponent(machineId)}`,
        },
        {
          title: "Xem hồ sơ máy",
          description: "Xem chi tiết máy trong khu làm việc theo đúng vai trò.",
          icon: "eye",
          tone: "action-card--amber",
          href: getAdminDetailHref(machineId, currentUser?.role),
        },
        {
          title: "Đăng ký Đại lý / CTV",
          description: "Mở form đăng ký và đồng bộ mã đại lý với mã khách hàng trên CRM.",
          icon: "store",
          tone: "action-card--blue",
          href: "/dealer-register",
        },
      ];
    }

    const customerActions: ActionItem[] = [];

    if (!isActivated) {
      customerActions.push({
        title: "Kích hoạt máy",
        description: "Ghi nhận khách hàng, GPS và ảnh lắp đặt.",
        icon: "droplet",
        tone: "action-card--emerald",
        href: hasStepOne
          ? `/activate/${encodeURIComponent(machineId)}/step-2`
          : `/activate/${encodeURIComponent(machineId)}/step-1`,
      });
    }

    customerActions.push(
      {
        title: "Đăng ký Đại lý / CTV",
        description: "Dành cho đơn vị, kỹ thuật hoặc cộng tác viên muốn nhận lệnh dịch vụ KOSOVOTA.",
        icon: "store",
        tone: "action-card--amber",
        href: "/dealer-register",
      },
      {
        title: "Báo cáo dịch vụ",
        description: "Gửi yêu cầu thay lõi, sửa chữa hoặc hỗ trợ kỹ thuật.",
        icon: "wrench",
        tone: "action-card--rose",
        href: `/service-report/${encodeURIComponent(machineId)}`,
      },
      {
        title: "Máy của tôi",
        description: "Xem bảo hành, lịch sử và kỳ bảo trì tiếp theo.",
        icon: "search",
        tone: "action-card--blue",
        href: `/customer-portal?machineId=${encodeURIComponent(machineId)}`,
      },
    );

    return customerActions;
  }, [currentUser?.role, hasStepOne, isActivated, isStaff, machineId]);

  async function copyQrLink() {
    try {
      await navigator.clipboard.writeText(qrTargetUrl);
    } catch {
      // Trình duyệt cũ có thể không hỗ trợ Clipboard API.
    }
  }

  useEffect(() => {
    async function loadQrPageData() {
      try {
        const [activationResponse, machineResponse, authResponse] =
          await Promise.all([
            fetch(
              `/api/activations?machineId=${encodeURIComponent(machineId)}&step=1`,
              { cache: "no-store" },
            ),
            fetch(`/api/machines/${encodeURIComponent(machineId)}`, {
              cache: "no-store",
            }),
            fetch("/api/auth/me", { cache: "no-store" }),
          ]);

        const [activationResult, machineResult] = await Promise.all([
          activationResponse.json(),
          machineResponse.json(),
        ]);

        setHasStepOne(
          Boolean(
            activationResult.success && activationResult.data?.length > 0,
          ),
        );

        if (machineResponse.ok && machineResult.success) {
          setMachine(machineResult.data);
        } else {
          setMachineError(
            machineResult.message || "Mã máy chưa có trong hệ thống.",
          );
        }

        if (authResponse.ok) {
          const authResult = await authResponse.json();
          if (authResult.success) setCurrentUser(authResult.user);
        }
      } catch {
        setHasStepOne(false);
        setMachineError("Không kiểm tra được mã máy lúc này.");
      } finally {
        setCheckingActivation(false);
      }
    }

    void loadQrPageData();
  }, [machineId]);

  return (
    <main className="public-page min-h-screen px-4 py-7 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="surface-card overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
            <div className="p-6 sm:p-9">
              <Brand size="lg" />
              <p className="eyebrow mt-8">
                {isStaff
                  ? "Khu thao tác QR cho nhân sự"
                  : "Trung tâm dịch vụ QR"}
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                {isStaff
                  ? "Thao tác nghiệp vụ với thiết bị"
                  : "Chọn thao tác cho thiết bị"}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                {isStaff
                  ? "Bạn đang đăng nhập vai trò vận hành/KTV/đại lý/CTV, nên QR sẽ hiện bước kích hoạt và hồ sơ kỹ thuật thay vì giao diện khách hàng."
                  : "Mỗi thao tác được liên kết với đúng mã máy. Dữ liệu khách hàng chỉ hiển thị sau khi xác thực phù hợp."}
              </p>
              {currentUser && (
                <div className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                  <Icon name="user" size={17} />
                  {currentUser.name || "Tài khoản đang đăng nhập"} ·{" "}
                  {currentUser.role}
                </div>
              )}
            </div>
            <div className="qr-device-panel p-6 sm:p-9">
              <div className="icon-orb icon-orb--light">
                <Icon name="qr" size={30} />
              </div>
              <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-100">
                ID thiết bị
              </p>
              <p className="mt-2 break-all text-xl font-extrabold text-white sm:text-2xl">
                {machineId}
              </p>
              {machine && (
                <div className="mt-3 rounded-2xl bg-white/10 p-3 text-sm text-emerald-50">
                  <strong className="block text-white">
                    {machine.name || "Thiết bị KOSOVOTA"}
                  </strong>
                  <span>
                    {machine.model}
                    {machine.capacity ? ` · ${machine.capacity}` : ""}
                  </span>
                </div>
              )}
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
                <img
                  src={qrImageUrl}
                  alt={`QR máy ${machineId}`}
                  className="h-40 w-40"
                />
              </div>
              <div>
                <p className="eyebrow">Tem QR thiết bị</p>
                <h2 className="mt-2 text-xl font-extrabold">
                  Tải hoặc in QR để dán lên máy
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  QR dẫn thẳng tới cổng thiết bị này. Khách hàng xác thực số điện thoại bằng OTP để xem đúng các máy đang sở hữu; đây là cách đăng nhập thứ hai ngoài việc nhập số điện thoại tại cổng khách hàng. Khi chạy thật, hãy đặt{" "}
                  <code>NEXT_PUBLIC_APP_URL</code> bằng tên miền HTTPS của hệ
                  thống trước khi in hàng loạt.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={qrImageUrl}
                    download={`KOSOVOTA-${machineId}.png`}
                    className="btn-primary px-4 py-3 font-bold text-white"
                  >
                    <Icon name="download" size={18} /> Tải PNG
                  </a>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn-secondary"
                  >
                    <Icon name="file" size={18} /> In trang
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyQrLink()}
                    className="btn-secondary"
                  >
                    <Icon name="copy" size={18} /> Sao chép link
                  </button>
                  <Link href="/scan" className="btn-secondary">
                    <Icon name="camera" size={18} /> Mở máy quét
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mt-5 space-y-3">
          {machineError && <Notice kind="error">{machineError}</Notice>}
          {checkingActivation ? (
            <LoadingState label="Đang kiểm tra trạng thái kích hoạt..." />
          ) : isStaff ? (
            <Notice kind="info">
              Đã nhận diện vai trò {currentUser?.role}. Trang này hiển thị thao
              tác cho nhân sự: kích hoạt/cập nhật máy, dịch vụ và hồ sơ máy.
            </Notice>
          ) : isActivated ? (
            <Notice kind="info">
              Máy này đã kích hoạt nên khách hàng chỉ còn xem bảo hành hoặc gửi
              báo cáo dịch vụ.
            </Notice>
          ) : null}
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {actions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className={`action-card ${action.tone}`}
            >
              <span className="action-card__icon">
                <Icon name={action.icon} size={26} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-base font-extrabold text-slate-950 sm:text-lg">
                  {action.title}
                </strong>
                <span className="mt-1 block text-sm leading-6 text-slate-600">
                  {action.description}
                </span>
              </span>
              <Icon name="chevron-right" className="shrink-0 text-slate-400" />
            </Link>
          ))}
        </section>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {isStaff && (
            <Link
              href={getWorkHome(currentUser?.role)}
              className="btn-primary px-5 py-3 font-bold text-white"
            >
              <Icon name="home" size={18} /> Về khu làm việc
            </Link>
          )}
          <SmartBackButton fallbackHref={getWorkHome(currentUser?.role)} />
        </div>
      </div>
    </main>
  );
}
