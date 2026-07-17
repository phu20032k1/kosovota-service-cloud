"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { homeForRole, ROLE_LABEL, type InternalRole } from "@/lib/access-control";

type LoginRole = "CUSTOMER" | "ADMIN" | "CSKH" | "DEALER" | "KTV";
type CurrentUser = { name: string; role: InternalRole };

const ROLE_OPTIONS: Array<{
  value: LoginRole;
  title: string;
  description: string;
  icon: IconName;
  helper: string;
}> = [
  { value: "CUSTOMER", title: "Khách hàng", description: "Xem máy, bảo hành, lịch bảo trì và gửi SOS.", icon: "user", helper: "Khách hàng dùng OTP tại cổng khách hàng, không cần tài khoản nội bộ." },
  { value: "ADMIN", title: "Admin", description: "Quản trị toàn bộ dữ liệu, báo cáo, kho và đối soát.", icon: "shield", helper: "Chỉ tài khoản ADMIN mới vào được khu quản trị." },
  { value: "CSKH", title: "CSKH", description: "Chăm sóc khách, lịch CSOS, bản đồ và phiếu hỗ trợ.", icon: "phone", helper: "Dữ liệu được lọc theo phạm vi tỉnh nếu tài khoản có provinceScope." },
  { value: "DEALER", title: "Đại lý", description: "Quản lý lệnh, KTV, kho và thanh toán của đại lý.", icon: "store", helper: "Đại lý chỉ thấy dữ liệu thuộc mã đại lý của mình và có thể quản lý KTV nội bộ." },
  { value: "KTV", title: "KTV", description: "Nhận lệnh được giao và gửi báo cáo tại nhà khách.", icon: "wrench", helper: "KTV chỉ thao tác lệnh/báo cáo thuộc đại lý của mình, không thấy doanh thu toàn hệ thống." },
];

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "";
  const [role, setRole] = useState<LoginRole>("CUSTOMER");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const selectedRole = useMemo(() => ROLE_OPTIONS.find((item) => item.value === role) || ROLE_OPTIONS[0], [role]);
  const customerMode = role === "CUSTOMER";

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (cancelled) return;
        if (response.ok && result.success) setCurrentUser(result.user as CurrentUser);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function logoutCurrent() {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setPhone("");
    setPassword("");
    router.refresh();
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (customerMode) {
      router.push("/customer-portal");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password, role, next: nextPath }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.message || "Không thể đăng nhập.");
        return;
      }
      router.replace(result.redirect || "/");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="auth-page grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
    <section className="auth-side hidden p-10 lg:flex lg:flex-col lg:justify-between xl:p-16">
      <div className="absolute -left-28 top-1/3 h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl"/><div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-cyan-300/10 blur-3xl"/>
      <div className="relative"><Brand inverse/></div>
      <div className="relative max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300"/> Đăng nhập theo đúng vị trí</div>
        <h1 className="mt-6 text-5xl font-black leading-[1.12] tracking-[-.05em] xl:text-6xl">Mỗi người vào đúng màn hình cần làm việc.</h1>
        <p className="mt-5 max-w-lg text-base leading-8 text-emerald-50/70">Khách hàng dùng OTP. Admin, CSKH, Đại lý và KTV đăng nhập bằng tài khoản nội bộ, sau đó hệ thống tự chuyển về đúng cổng.</p>
        <div className="mt-9 grid grid-cols-2 gap-3">{ROLE_OPTIONS.map((item)=><button key={item.value} type="button" onClick={()=>setRole(item.value)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${role===item.value?"border-emerald-300 bg-emerald-300/18":"border-white/10 bg-white/8 hover:bg-white/12"}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/12 text-emerald-200"><Icon name={item.icon} size={20}/></span><span><span className="block text-sm font-bold">{item.title}</span><span className="mt-1 block text-xs text-white/50">{item.description}</span></span></button>)}</div>
      </div>
      <p className="relative text-xs text-white/45">KOSOVOTA Service Cloud — Không chia sẻ tài khoản hoặc OTP.</p>
    </section>

    <section className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_100%_0,rgba(16,185,129,.12),transparent_24rem)] px-4 py-10 sm:px-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center lg:hidden"><Brand inverse/></div>
        <form onSubmit={submitLogin} className="auth-panel p-7 sm:p-9">
          <div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-emerald-700">KOSOVOTA SERVICE CLOUD</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em] text-slate-950">Bạn đăng nhập với vai trò nào?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Chọn đúng vị trí để hệ thống mở đúng màn hình và quyền dữ liệu.</p></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">{ROLE_OPTIONS.map((item)=><button key={item.value} type="button" onClick={()=>setRole(item.value)} className={`rounded-2xl border p-4 text-left transition ${role===item.value?"border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm":"border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50"}`}><Icon name={item.icon} size={20}/><strong className="mt-3 block text-sm">{item.title}</strong><span className="mt-1 block text-xs leading-5 opacity-70">{item.description}</span></button>)}</div>
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><strong>{selectedRole.title}:</strong> {selectedRole.helper}</div>
          {currentUser&&<div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><p><strong>Đang đăng nhập:</strong> {currentUser.name} · {ROLE_LABEL[currentUser.role]}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>router.replace(homeForRole(currentUser.role))} className="rounded-xl bg-blue-700 px-3 py-2 font-bold text-white">Vào màn hình hiện tại</button><button type="button" onClick={()=>void logoutCurrent()} className="rounded-xl border border-blue-300 bg-white px-3 py-2 font-bold">Đăng xuất để đổi tài khoản</button></div></div>}
          {error&&<div className="mt-6"><Notice kind="error">{error}</Notice></div>}

          {!customerMode && <div className="mt-7 space-y-5"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Số điện thoại</span><div className="relative"><Icon name="phone" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input type="tel" inputMode="numeric" value={phone} onChange={(e)=>setPhone(e.target.value.replace(/\D/g,""))} placeholder="Nhập số điện thoại" className="pl-11" required={!customerMode} minLength={10} autoComplete="username"/></div></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Mật khẩu</span><div className="relative"><Icon name="lock" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input type={showPassword?"text":"password"} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Nhập mật khẩu" className="pl-11 pr-12" required={!customerMode} autoComplete="current-password"/><button type="button" onClick={()=>setShowPassword((v)=>!v)} className="absolute right-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-emerald-700" title={showPassword?"Ẩn mật khẩu":"Hiện mật khẩu"}><Icon name={showPassword?"eye-off":"eye"} size={18}/></button></div></label></div>}

          <button type="submit" disabled={submitting} className="btn-primary mt-7 flex w-full items-center justify-center gap-2 px-5 py-4 text-base font-extrabold text-white disabled:opacity-60">{customerMode?<><Icon name="user" size={18}/>Tiếp tục cổng khách hàng</>:submitting?<><span className="animate-spin"><Icon name="refresh" size={19}/></span>Đang đăng nhập...</>:<><Icon name="lock" size={18}/>Đăng nhập {selectedRole.title}</>}</button>
          <div className="mt-5 flex items-center justify-between gap-3 text-sm"><Link href="/forgot-password" className="font-semibold text-slate-500 hover:text-emerald-700">Quên mật khẩu?</Link><Link href="/dealer-register" className="font-semibold text-slate-500 hover:text-emerald-700">Đăng ký đại lý</Link><Link href="/" className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-emerald-700">Trang chủ <Icon name="chevron-right" size={15}/></Link></div>
        </form>
      </div>
    </section>
  </main>;
}


export default function LoginPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-950 text-white">Đang mở trang đăng nhập...</main>}><LoginPageContent /></Suspense>;
}
