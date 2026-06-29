"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

function ForbiddenPageContent() {
  const searchParams = useSearchParams();
  const home = searchParams.get("home") || "/login";
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-100 text-amber-700"><Icon name="lock" size={34}/></div>
        <h1 className="mt-5 text-2xl font-black text-slate-900">Không đúng khu vực làm việc</h1>
        <p className="mt-3 leading-6 text-slate-600">Tài khoản đang đăng nhập không được mở màn hình này. Hệ thống đã chặn để tránh lộ dữ liệu giữa các vai trò.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={home} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Về đúng trang của tôi</Link>
          <Link href="/login" className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700">Đổi tài khoản</Link>
        </div>
      </section>
    </main>
  );
}


export default function ForbiddenPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-100">Đang kiểm tra quyền truy cập...</main>}><ForbiddenPageContent /></Suspense>;
}
