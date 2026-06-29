"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, password, role: "SUPER_ADMIN" }) });
      const result = await response.json();
      if (!response.ok || !result.success) { setError(result.message || "Không đăng nhập được."); return; }
      router.replace("/super-admin"); router.refresh();
    } catch { setError("Không kết nối được máy chủ."); }
    finally { setSubmitting(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-white">
    <form onSubmit={submit} className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white p-8 text-slate-950 shadow-2xl">
      <Brand />
      <div className="mt-8 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-800"><strong>Khu SUPER_ADMIN ẩn.</strong> Không hiển thị ngoài trang chủ, không nằm trong màn đăng nhập thường. Chỉ dùng để tạo/khóa tài khoản cấp dưới.</div>
      {error && <div className="mt-5"><Notice kind="error">{error}</Notice></div>}
      <label className="mt-6 block"><span className="mb-2 block text-sm font-bold">Số điện thoại SUPER_ADMIN</span><input value={phone} onChange={(e)=>setPhone(e.target.value.replace(/\D/g,""))} required className="w-full" placeholder="Nhập số điện thoại quản trị gốc"/></label>
      <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Mật khẩu</span><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required className="w-full" placeholder="••••••••"/></label>
      <button disabled={submitting} className="btn-primary mt-6 flex w-full items-center justify-center gap-2 px-5 py-4 font-extrabold text-white"><Icon name="shield" size={18}/>{submitting ? "Đang kiểm tra..." : "Vào khu SUPER_ADMIN"}</button>
    </form>
  </main>;
}
