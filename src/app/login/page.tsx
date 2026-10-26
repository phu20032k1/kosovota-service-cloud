"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { homeForRole, ROLE_LABEL, type InternalRole } from "@/lib/access-control";

type LoginRole = "CUSTOMER" | InternalRole;
type CurrentUser = { name: string; role: InternalRole; mustChangePassword?: boolean };

type RoleOption = { value: LoginRole; title: string; description: string; icon: IconName; helper: string };
const ROLE_OPTIONS: RoleOption[] = [
  { value: "CUSTOMER", title: "Khách hàng", description: "Bảo hành, lịch bảo trì và yêu cầu sửa chữa.", icon: "user", helper: "Khách hàng dùng cổng riêng, không cần tài khoản nội bộ." },
  { value: "ADMIN", title: "Quản trị hệ thống", description: "Dữ liệu, tài khoản, cấu hình và vận hành.", icon: "shield", helper: "Quản trị hệ thống có quyền cấu hình và quản lý tài khoản vận hành." },
  { value: "CSKH", title: "Chăm sóc khách hàng", description: "Chăm sóc, điều phối và theo dõi yêu cầu.", icon: "phone", helper: "CSKH làm việc trong phạm vi dữ liệu được giao." },
  { value: "SALES_MANAGER", title: "Trưởng phòng Kinh doanh", description: "Cơ hội bán lõi, đại lý và hiệu suất kinh doanh.", icon: "activity", helper: "Quản lý cơ hội bán lõi, hồ sơ đối tác và hiệu suất đại lý." },
  { value: "DIRECTOR", title: "Giám đốc", description: "Báo cáo điều hành chỉ xem và xuất dữ liệu.", icon: "chart-bar", helper: "Giám đốc chỉ xem báo cáo, bản đồ và xuất dữ liệu; không sửa dữ liệu vận hành." },
  { value: "DEALER", title: "Đại lý", description: "Nhận lệnh, giao KTV, hồ sơ và công dịch vụ.", icon: "store", helper: "Đại lý chỉ thấy lệnh và dữ liệu thuộc đơn vị của mình." },
  { value: "CTV", title: "CTV kỹ thuật", description: "Nhận lệnh và tự thực hiện dịch vụ.", icon: "users", helper: "CTV nhận lệnh, kích hoạt máy và báo cáo dịch vụ theo quyền được giao." },
  { value: "KTV", title: "Kỹ thuật viên", description: "Làm lệnh đại lý giao và gửi báo cáo.", icon: "wrench", helper: "KTV chỉ thấy các lệnh được giao trực tiếp cho mình." },
];

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "";
  const [role, setRole] = useState<LoginRole>("CUSTOMER");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const selected = useMemo(() => ROLE_OPTIONS.find((item) => item.value === role) || ROLE_OPTIONS[0], [role]);
  const customerMode = role === "CUSTOMER";

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => { if (response.ok && result.success) setCurrentUser(result.user); })
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (customerMode) { router.push("/customer-portal"); return; }
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, password, role, next: nextPath }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không thể đăng nhập.");
      router.replace(result.redirect || "/"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không kết nối được máy chủ."); }
    finally { setSubmitting(false); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }); setCurrentUser(null); setPhone(""); setPassword(""); router.refresh();
  }

  return <main className="min-h-screen bg-slate-950 lg:grid lg:grid-cols-[.95fr_1.05fr]">
    <section className="hidden min-h-screen flex-col justify-between bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,.25),transparent_28rem)] p-10 text-white lg:flex xl:p-14">
      <Brand inverse/>
      <div className="max-w-xl"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">KOSOVOTA SERVICE CLOUD</p><h1 className="mt-5 text-5xl font-black leading-tight tracking-[-.045em]">Mỗi vai trò vào đúng công việc của mình.</h1><p className="mt-5 max-w-lg text-base leading-7 text-white/65">Quyền dữ liệu được tách theo CSKH, Kinh doanh, Giám đốc, Đại lý, CTV và Kỹ thuật viên.</p></div>
      <p className="text-xs text-white/40">Không chia sẻ tài khoản hoặc mật khẩu tạm.</p>
    </section>

    <section className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-8">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-xl sm:p-8">
        <div className="lg:hidden"><Brand/></div>
        <p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-emerald-700 lg:mt-0">Đăng nhập</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">Chọn đúng vai trò</h2>
        <p className="mt-2 text-sm text-slate-500">Hệ thống sẽ chuyển thẳng đến màn hình và quyền dữ liệu tương ứng.</p>

        {currentUser && <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><p><strong>Đang đăng nhập:</strong> {currentUser.name} · {ROLE_LABEL[currentUser.role]}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>router.replace(currentUser.mustChangePassword ? "/change-password" : homeForRole(currentUser.role))} className="rounded-xl bg-blue-700 px-3 py-2 font-bold text-white">Vào màn hình hiện tại</button><button type="button" onClick={()=>void logout()} className="rounded-xl border border-blue-300 bg-white px-3 py-2 font-bold">Đăng xuất</button></div></div>}

        <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{ROLE_OPTIONS.map((item)=><button key={item.value} type="button" onClick={()=>setRole(item.value)} className={`rounded-2xl border p-3 text-left transition ${role===item.value?"border-emerald-500 bg-emerald-50 text-emerald-950":"border-slate-200 bg-white text-slate-600 hover:border-emerald-200"}`}><Icon name={item.icon} size={19}/><strong className="mt-2 block text-sm">{item.title}</strong><span className="mt-1 block text-xs leading-5 opacity-70">{item.description}</span></button>)}</div>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><strong className="text-slate-900">{selected.title}:</strong> {selected.helper}</div>
        {error && <div className="mt-5"><Notice kind="error">{error}</Notice></div>}

        {!customerMode && <div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className="field-label">Số điện thoại</span><div className="relative"><Icon name="phone" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className="w-full pl-10" type="tel" inputMode="numeric" autoComplete="username" value={phone} onChange={(e)=>setPhone(e.target.value.replace(/\D/g,""))} required/></div></label><label><span className="field-label">Mật khẩu</span><div className="relative"><Icon name="lock" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className="w-full pl-10 pr-12" type={showPassword?"text":"password"} autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)} required/><button type="button" onClick={()=>setShowPassword((value)=>!value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400"><Icon name={showPassword?"eye-off":"eye"} size={17}/></button></div></label></div>}

        <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full p-3.5 font-black text-white disabled:opacity-50">{customerMode ? "Mở cổng khách hàng" : submitting ? "Đang đăng nhập..." : `Đăng nhập ${selected.title}`}</button>
        <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm"><Link href="/forgot-password" className="font-semibold text-slate-500">Quên mật khẩu?</Link><Link href="/dealer-register" className="font-semibold text-slate-500">Đăng ký đối tác</Link><Link href="/" className="font-semibold text-slate-500">Trang chủ</Link></div>
      </form>
    </section>
  </main>;
}

export default function LoginPage() { return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-950 text-white">Đang mở trang đăng nhập...</main>}><LoginPageContent/></Suspense>; }
