import Link from "next/link";
import { PublicNavbar } from "@/components/PublicNavbar";
import PublicNetworkMap from "@/components/PublicNetworkMap";
import { Brand } from "@/components/ui/Brand";
import { Icon, type IconName } from "@/components/ui/Icon";

const values: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: "shield", title: "Minh bạch", text: "Mỗi thiết bị, lịch chăm sóc và báo cáo dịch vụ đều được lưu theo định danh rõ ràng." },
  { icon: "map-pin", title: "Phục vụ gần hơn", text: "Kết nối khách hàng với đại lý và kỹ thuật viên phù hợp theo khu vực hoạt động." },
  { icon: "activity", title: "Vận hành liên tục", text: "Theo dõi xuyên suốt từ lắp đặt, kích hoạt, bảo hành đến bảo trì định kỳ." },
];

export default function AboutPage() {
  return <main className="min-h-screen bg-[#f5f8f7] text-slate-950">
    <PublicNavbar />
    <section className="overflow-hidden bg-[linear-gradient(135deg,#042f27,#065f46_55%,#0f766e)] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
        <div><p className="text-xs font-black uppercase tracking-[.24em] text-emerald-200">Giới thiệu KOSOVOTA</p><h1 className="mt-4 text-4xl font-black tracking-[-.045em] sm:text-6xl">Kết nối sản phẩm, khách hàng và dịch vụ trên một hệ thống.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-emerald-50/75">KOSOVOTA xây dựng hệ sinh thái quản lý máy lọc nước và dịch vụ sau bán hàng, giúp mọi điểm chạm từ đại lý đến khách hàng được theo dõi nhất quán.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/map" className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-black text-emerald-900"><Icon name="map" size={19}/> Xem mạng lưới</Link><Link href="/contact" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5 font-black"><Icon name="send" size={18}/> Liên hệ tư vấn</Link></div></div>
        <div className="rounded-[2rem] border border-white/12 bg-white/10 p-6 backdrop-blur"><p className="text-sm font-bold text-emerald-100">Một nền tảng thống nhất</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{["Quản lý máy theo QR", "Theo dõi bảo hành", "Điều phối theo bản đồ", "Chăm sóc định kỳ"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-950/20 p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-300 text-emerald-950"><Icon name="check" size={17}/></span><strong>{item}</strong></div>)}</div></div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6"><div className="grid gap-5 md:grid-cols-3">{values.map((item) => <article key={item.title} className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon name={item.icon} size={23}/></span><h2 className="mt-5 text-xl font-black">{item.title}</h2><p className="mt-3 leading-7 text-slate-600">{item.text}</p></article>)}</div></section>
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6"><div className="mb-8 max-w-3xl"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">Mạng lưới thực tế</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">Dữ liệu bản đồ được cập nhật từ khu vực quản trị</h2><p className="mt-4 leading-7 text-slate-600">Khi Admin nhập hoặc cập nhật vị trí máy và đại lý, dữ liệu đủ điều kiện sẽ được tổng hợp tại đây.</p></div><PublicNetworkMap compact /></section>
    <footer className="bg-slate-950 text-slate-400"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-center md:justify-between"><Brand inverse/><span>© 2026 KOSOVOTA</span></div></footer>
  </main>;
}
