import Link from "next/link";
import { notFound } from "next/navigation";
import { findProductBySlug, PRODUCTS } from "@/data/products";
import { Icon } from "@/components/ui/Icon";
import { Brand } from "@/components/ui/Brand";

export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = findProductBySlug(slug);
  if (!product) notFound();

  return (
    <main className="min-h-screen bg-slate-50">
      <header className={`bg-gradient-to-br ${product.accent} text-white`}>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex items-center justify-between"><Brand inverse/><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-white/70 hover:text-white"><Icon name="chevron-right" size={16} className="rotate-180"/> Danh mục sản phẩm</Link></div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-white/70">{product.category}</p>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">{product.name}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/80">{product.description}</p>
            </div>
            <div className="flex h-52 items-center justify-center rounded-[2rem] border border-white/15 bg-white/10 backdrop-blur"><Icon name={product.icon} size={84} strokeWidth={1.4}/></div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-8">
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-black">Điểm nổi bật</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {product.highlights.map((highlight) => (
                <div key={highlight} className="rounded-2xl bg-emerald-50 p-5 font-bold text-emerald-950">
                  <span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Icon name="check" size={13}/></span>{highlight}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-black">Lịch chăm sóc theo dòng máy</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Lịch được tự động tạo từ ngày kích hoạt lắp đặt và hiển thị trong CSOS.</p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              {product.maintenancePlan.map((item, index) => (
                <div key={`${item.title}-${index}`} className="grid grid-cols-[110px_1fr] gap-4 border-b border-slate-200 px-5 py-4 last:border-0">
                  <div className="font-black text-emerald-700">
                    {item.daysAfterInstallation ? `${item.daysAfterInstallation} ngày` : `${item.monthsAfterInstallation} tháng`}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{item.title}</p>
                    {item.customerCare && <p className="mt-1 text-xs font-semibold text-blue-600">Chăm sóc khách hàng</p>}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <aside className="h-fit rounded-3xl bg-slate-900 p-7 text-white shadow-xl lg:sticky lg:top-24">
          <p className="text-sm font-black uppercase tracking-widest text-emerald-400">Mã cấu hình</p>
          <p className="mt-2 font-mono text-lg font-black">{product.modelCode}</p>
          <p className="mt-6 text-sm leading-6 text-white/65">Đăng ký để được tư vấn cấu hình phù hợp, điểm bán và dịch vụ lắp đặt tại khu vực của anh/chị.</p>
          <Link href={`/contact?product=${product.slug}`} className="mt-7 block rounded-xl bg-emerald-500 px-5 py-4 text-center font-black text-slate-950 hover:bg-emerald-400">
            ĐĂNG KÝ TƯ VẤN
          </Link>
          <Link href="/customer-portal" className="mt-3 block rounded-xl border border-white/20 px-5 py-4 text-center font-black hover:bg-white/10">
            TRA CỨU MÁY ĐÃ MUA
          </Link>
        </aside>
      </div>
    </main>
  );
}
