import Link from "next/link";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon, type IconName } from "@/components/ui/Icon";

const tools: Array<{ href: string; title: string; description: string; icon: IconName }> = [
  {
    href: "/cskh/requests",
    title: "Yêu cầu khách hàng",
    description: "Tạo, theo dõi và xem lệnh điều phối liên kết của từng yêu cầu.",
    icon: "file",
  },
  {
    href: "/csos",
    title: "Điều phối CSOS",
    description: "Theo dõi lịch chăm sóc, SOS, lệnh dịch vụ và giao đại lý.",
    icon: "route",
  },
  {
    href: "/customer-map",
    title: "Bản đồ khách hàng",
    description: "Xem vị trí khách hàng và máy trong phạm vi được phân quyền.",
    icon: "map",
  },
  {
    href: "/dealer-map",
    title: "Bản đồ đại lý",
    description: "Tra cứu đại lý phù hợp để hỗ trợ điều phối nhanh hơn.",
    icon: "store",
  },
];

export default function CustomerCareWorkspacePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader
        title="Trung tâm CSKH"
        subtitle="Chỉ hiển thị các chức năng dành cho nhân viên chăm sóc khách hàng"
      />

      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <section className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-200">Không gian làm việc riêng</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">Xử lý yêu cầu và điều phối trong một luồng rõ ràng</h1>
          <p className="mt-4 max-w-3xl leading-7 text-emerald-50/75">
            CSKH không còn phải mở khu vực Admin. Mỗi chức năng bên dưới đều dẫn tới đúng màn hình được phép sử dụng.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl"
            >
              <span className="grid h-13 w-13 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Icon name={tool.icon} size={24} />
              </span>
              <h2 className="mt-5 text-xl font-black text-slate-950">{tool.title}</h2>
              <p className="mt-2 leading-7 text-slate-600">{tool.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 font-black text-emerald-700">
                Mở chức năng <Icon name="chevron-right" size={17} className="transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
