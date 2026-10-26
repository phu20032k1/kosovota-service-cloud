"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { Notice } from "@/components/ui/Notice";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không đổi được mật khẩu");
      router.replace(result.redirect || "/"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Không đổi được mật khẩu"); }
    finally { setBusy(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-100 p-4"><form onSubmit={submit} className="auth-panel w-full max-w-md p-7 sm:p-9"><Brand/><p className="mt-7 text-xs font-black uppercase tracking-[.18em] text-emerald-700">Bảo mật tài khoản</p><h1 className="mt-2 text-3xl font-black text-slate-950">Đổi mật khẩu lần đầu</h1><p className="mt-2 text-sm leading-6 text-slate-500">Mật khẩu tạm chỉ dùng để đăng nhập lần đầu. Hãy đặt mật khẩu riêng trước khi tiếp tục làm việc.</p>{error&&<div className="mt-5"><Notice kind="error">{error}</Notice></div>}<div className="mt-6 space-y-4"><label className="block"><span className="field-label">Mật khẩu tạm / hiện tại *</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} required/></label><label className="block"><span className="field-label">Mật khẩu mới *</span><input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} required/></label><label className="block"><span className="field-label">Nhập lại mật khẩu mới *</span><input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required/></label></div><p className="mt-3 text-xs text-slate-500">Ít nhất 8 ký tự, có chữ và số.</p><button type="submit" disabled={busy} className="btn-primary mt-6 w-full p-3.5 font-black text-white disabled:opacity-50">{busy?"Đang đổi...":"Đổi mật khẩu và tiếp tục"}</button></form></main>;
}
