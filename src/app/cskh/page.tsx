import Link from "next/link";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon, type IconName } from "@/components/ui/Icon";

const tools: Array<{ href: string; title: string; description: string; icon: IconName }> = [
  { href: "/cskh/customers", title: "Khách hàng", description: "Tìm khách hàng, máy và Seri trong đúng phạm vi tỉnh được giao.", icon: "users" },
  { href: "/cskh/dealers", title: "Đại lý theo tỉnh", description: "Danh sách chỉ đọc; không có quyền sửa, xóa hoặc duyệt đại lý.", icon: "store" },
  { href: "/cskh/requests", title: "Yêu cầu khách hàng", description: "Tạo, theo dõi và xem lệnh điều phối liên kết của từng yêu cầu.", icon: "file" },
  { href: "/cskh/dispatch", title: "Điều phối CSOS", description: "Theo dõi lịch chăm sóc, SOS, lệnh dịch vụ và giao đại lý.", icon: "route" },
  { href: "/customer-map", title: "Bản đồ khách hàng", description: "Xem vị trí khách hàng và máy trong phạm vi được phân quyền.", icon: "map" },
  { href: "/dealer-map", title: "Bản đồ đại lý", description: "Tra cứu đại lý trong đúng tỉnh được giao để hỗ trợ điều phối.", icon: "store" },
];

export default function CustomerCareWorkspacePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader title="Trung tâm CSKH" subtitle="Chức năng và dữ liệu được giới hạn theo phạm vi tỉnh của tài khoản" />
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <section className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-200">Không gian làm việc riêng</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">CSKH chỉ thấy đúng khách hàng, máy và đại lý thuộc tỉnh được giao</h1>
          <p className="mt-4 max-w-3xl leading-7 text-emerald-50/75">Phạm vi chấp nhận đồng thời tên tỉnh, mã chữ và mã số. Quyền duyệt/sửa/xóa đại lý vẫn thuộc Admin.</p>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon name={tool.icon} size={24} /></span>
              <h2 className="mt-5 text-xl font-black text-slate-950">{tool.title}</h2>
              <p className="mt-2 leading-7 text-slate-600">{tool.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 font-black text-emerald-700">Mở chức năng <Icon name="chevron-right" size={17} className="transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
