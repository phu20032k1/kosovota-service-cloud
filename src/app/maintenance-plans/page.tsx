import Link from "next/link";
import { PRODUCTS } from "@/data/products";

const TARGET_MODELS = ["RO_UNDER_30", "BCN_HOT_COLD", "BCN_COLUMN", "INDUSTRIAL"] as const;

function intervalLabel(item: { monthsAfterInstallation?: number; daysAfterInstallation?: number }) {
  if (item.daysAfterInstallation) return `${item.daysAfterInstallation} ngày sau lắp đặt`;
  if (item.monthsAfterInstallation) return `${item.monthsAfterInstallation} tháng sau lắp đặt`;
  return "Theo cấu hình";
}

export default function MaintenancePlansPage() {
  const plans = TARGET_MODELS.map((modelCode) => PRODUCTS.find((product) => product.modelCode === modelCode)).filter(Boolean);

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">KOSOVOTA · Định mức bảo trì</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">4 bảng lịch nhắc thay lõi theo dòng máy</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Mỗi model dùng đúng cấu hình vật tư và chu kỳ riêng. Lịch thực tế của từng máy được tính từ ngày lắp đặt.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/cskh/dispatch" className="btn-secondary">CSKH / Điều phối</Link>
              <Link href="/admin/reports" className="btn-secondary">Danh sách máy</Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          {plans.map((product, planIndex) => product && (
            <article key={product.modelCode} className="surface-card overflow-hidden">
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Bảng {planIndex + 1}</p>
                    <h2 className="mt-1 text-lg font-black text-slate-950">{product.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">Model: <strong>{product.modelCode}</strong></p>
                  </div>
                  <span className="status-pill status-slate">{product.category}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-slate-800 text-left text-white">
                    <tr>
                      <th className="p-3">STT</th>
                      <th className="p-3">Mốc</th>
                      <th className="p-3">Nội dung / vật tư</th>
                      <th className="p-3">Loại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {product.maintenancePlan.map((item, index) => (
                      <tr key={`${product.modelCode}-${index}`}>
                        <td className="p-3 font-bold">{index + 1}</td>
                        <td className="p-3 font-semibold text-slate-700">{intervalLabel(item)}</td>
                        <td className="p-3 font-bold text-slate-950">{item.title}</td>
                        <td className="p-3">
                          <span className={item.customerCare ? "status-pill status-slate" : "status-pill status-emerald"}>
                            {item.customerCare ? "Chăm sóc" : "Thay lõi / bảo trì"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
