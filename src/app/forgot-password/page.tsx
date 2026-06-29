"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type Step = "phone" | "otp" | "password" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function callApi(url: string, body: unknown) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không xử lý được yêu cầu.");
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xử lý được yêu cầu.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function submitPhone(event: FormEvent) {
    event.preventDefault();
    const result = await callApi("/api/auth/forgot-password/request", { phone });
    if (!result) return;
    setMessage(result.message);
    if (result.debugCode) setOtp(result.debugCode);
    setStep("otp");
  }

  async function submitOtp(event: FormEvent) {
    event.preventDefault();
    const result = await callApi("/api/auth/forgot-password/verify", { phone, otp });
    if (!result) return;
    setResetToken(result.resetToken);
    setMessage("");
    setStep("password");
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Hai mật khẩu không khớp.");
      return;
    }
    const result = await callApi("/api/auth/forgot-password/reset", { resetToken, newPassword });
    if (!result) return;
    setStep("done");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl sm:p-9">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">KOSOVOTA</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">Khôi phục mật khẩu</h1>
        <p className="mt-2 text-sm text-slate-500">Mã xác nhận có hiệu lực trong 5 phút và chỉ dùng một lần.</p>

        {message && <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div>}
        {error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        {step === "phone" && (
          <form onSubmit={submitPhone} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Số điện thoại tài khoản</span>
              <input className="form-input" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="Nhập số điện thoại" required />
            </label>
            <button disabled={loading} className="w-full rounded-xl bg-emerald-600 px-5 py-4 font-black text-white hover:bg-emerald-700 disabled:opacity-60">GỬI MÃ OTP</button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={submitOtp} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Mã OTP</span>
              <input className="form-input text-center text-xl tracking-[0.3em]" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="••••••" required />
            </label>
            <button disabled={loading} className="w-full rounded-xl bg-emerald-600 px-5 py-4 font-black text-white hover:bg-emerald-700 disabled:opacity-60">XÁC NHẬN OTP</button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={submitPassword} className="mt-6 space-y-4">
            <label className="block"><span className="mb-2 block text-sm font-bold">Mật khẩu mới</span><input className="form-input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label>
            <label className="block"><span className="mb-2 block text-sm font-bold">Nhập lại mật khẩu</span><input className="form-input" type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></label>
            <button disabled={loading} className="w-full rounded-xl bg-emerald-600 px-5 py-4 font-black text-white hover:bg-emerald-700 disabled:opacity-60">ĐẶT LẠI MẬT KHẨU</button>
          </form>
        )}

        {step === "done" && (
          <div className="mt-6 text-center">
            <div className="icon-orb mx-auto"><Icon name="check" size={30} /></div>
            <h2 className="mt-4 text-xl font-black">Đã cập nhật mật khẩu</h2>
            <Link href="/login" className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 font-black text-white hover:bg-emerald-700">VỀ ĐĂNG NHẬP</Link>
          </div>
        )}

        {step !== "done" && <Link href="/login" className="mt-5 inline-block text-sm font-bold text-slate-500 hover:text-emerald-700">← Quay lại đăng nhập</Link>}
      </section>
    </main>
  );
}
