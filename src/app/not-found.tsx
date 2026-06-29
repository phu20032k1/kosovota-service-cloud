import Link from "next/link";
import { Brand } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";

export default function NotFound() {
  return (
    <main className="public-page flex min-h-screen items-center justify-center px-4">
      <section className="surface-card w-full max-w-lg p-8 text-center sm:p-10">
        <Brand className="justify-center" />
        <div className="icon-orb mx-auto mt-8"><Icon name="navigation" size={30} /></div>
        <p className="eyebrow mt-6">Lỗi 404</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Không tìm thấy trang</h1>
        <p className="mt-3 leading-7 text-slate-600">Đường dẫn không tồn tại, đã được thay đổi hoặc tài nguyên không còn khả dụng.</p>
        <Link href="/" className="btn-primary mt-7"><Icon name="home" size={18} /> Về trang chủ</Link>
      </section>
    </main>
  );
}
