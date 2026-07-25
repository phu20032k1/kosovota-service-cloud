import Link from "next/link";
import { PublicNavbar } from "@/components/PublicNavbar";
import PublicNetworkMap from "@/components/PublicNetworkMap";
import { Icon } from "@/components/ui/Icon";

export default function PublicMapPage() {
  return <main className="min-h-screen bg-[#f5f8f7] text-slate-950">
    <PublicNavbar />
    <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-700">Bản đồ hệ thống</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em] sm:text-5xl">Toàn bộ mạng lưới máy và đại lý</h1><p className="mt-4 text-lg leading-8 text-slate-600">Dữ liệu được tổng hợp từ các bản ghi vị trí do Admin nhập và cập nhật trong hệ thống.</p></div><Link href="/contact" className="btn-secondary self-start px-5 py-3 font-black"><Icon name="send" size={17}/> Liên hệ triển khai</Link></div></div></section>
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14"><PublicNetworkMap /></section>
  </main>;
}
