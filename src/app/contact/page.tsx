import Link from "next/link";
import LeadForm from "@/components/LeadForm";

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-bold text-slate-500 hover:text-emerald-700">← Về trang sản phẩm</Link>
        <div className="mt-7 text-center">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">KOSOVOTA</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Đăng ký tư vấn sản phẩm</h1>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">Thông tin được chuyển trực tiếp đến bộ phận phụ trách khu vực và lưu trên hệ thống chăm sóc khách hàng.</p>
        </div>
        <div className="mt-8"><LeadForm initialProduct={product} /></div>
      </div>
    </main>
  );
}
