import Link from "next/link";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon, type IconName } from "@/components/ui/Icon";

const tools: Array<{ href: string; title: string; description: string; icon: IconName }> = [
  { href: "/cskh/report", title: "Báo cáo CSKH", description: "Theo dõi chăm sóc, công việc cần làm, đại lý phụ trách và kết quả dịch vụ.", icon: "file" },
  { href: "/csos", title: "Công việc hôm nay", description: "Xem các lịch chăm sóc và công việc đang cần xử lý.", icon: "calendar" },
  { href: "/cskh/customers", title: "Khách hàng", description: "Tìm khách hàng, máy, số điện thoại và Seri.", icon: "users" },
  { href: "/cskh/tickets", title: "Yêu cầu khách hàng", description: "Tiếp nhận và theo dõi các yêu cầu đang xử lý.", icon: "alert" },
  { href: "/operations-map", title: "Điều phối", description: "Giao lệnh và theo dõi tiến độ xử lý dịch vụ.", icon: "route" },
  { href: "/cskh/dealers", title: "Đại lý", description: "Tra cứu đại lý và thông tin liên hệ để hỗ trợ khách hàng.", icon: "store" },
  { href: "/customer-map", title: "Bản đồ khách hàng", description: "Xem vị trí máy và khách hàng trên bản đồ.", icon: "map" },
  { href: "/dealer-map", title: "Bản đồ đại lý", description: "Tìm đại lý gần máy và xem năng lực dịch vụ.", icon: "store" },
];

export default function CustomerCareWorkspacePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader title="Trung tâm CSKH" subtitle="Chăm sóc khách hàng, điều phối và theo dõi kết quả" />
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <section className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-200">Trung tâm chăm sóc khách hàng</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">Mọi công việc CSKH ở một nơi</h1>
          <p className="mt-4 max-w-3xl leading-7 text-emerald-50/80">Mở báo cáo để cập nhật kết quả cuộc gọi, chọn công việc, tìm đại lý và theo dõi đến khi dịch vụ hoàn tất.</p>
          <Link href="/cskh/report" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <Icon name="file" size={18} /> Mở báo cáo CSKH
          </Link>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon name={tool.icon} size={24} /></span>
              <h2 className="mt-5 text-xl font-black text-slate-950">{tool.title}</h2>
              <p className="mt-2 leading-7 text-slate-600">{tool.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 font-black text-emerald-700">Mở <Icon name="chevron-right" size={17} className="transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
