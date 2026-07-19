"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Dealer = {
  id: string;
  dealerCode: string;
  name: string;
  phone: string;
  email?: string | null;
  representativeName?: string | null;
  companyName?: string | null;
  registrationType?: string | null;
  birthDate?: string | null;
  province?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  locationType?: string | null;
  services?: string | null;
  technicianCount?: number | null;
  serviceArea?: string | null;
  taxCode?: string | null;
  citizenId?: string | null;
  bankAccount?: string | null;
  accountHolder?: string | null;
  bankName?: string | null;
  status: string;
  portraitPhoto?: string | null;
  storePhoto?: string | null;
  warehousePhoto?: string | null;
  videoName?: string | null;
  createdAt: string;
  serviceOrders: { id: string; orderCode: string; serviceType: string; status: string; customerName: string; createdAt: string }[];
  supportTickets: { id: string; ticketCode: string; subject: string; status: string; createdAt: string }[];
  paymentBatches: { id: string; batchCode: string; status: string; netAmount: number; createdAt: string }[];
};

type DealerForm = Record<string, string | number>;
const dateOnly = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 10) : "";
const displayDate = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value)) : "—";

export default function DealerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Dealer | null>(null);
  const [form, setForm] = useState<DealerForm>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dealers/${id}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được đại lý");
      const dealer = result.data as Dealer;
      setData(dealer);
      setForm({
        dealerCode: dealer.dealerCode,
        name: dealer.name,
        phone: dealer.phone,
        email: dealer.email || "",
        representativeName: dealer.representativeName || "",
        companyName: dealer.companyName || "",
        registrationType: dealer.registrationType || "",
        birthDate: dateOnly(dealer.birthDate),
        province: dealer.province || "",
        address: dealer.address || "",
        locationType: dealer.locationType || "",
        services: dealer.services || "",
        technicianCount: dealer.technicianCount || 0,
        serviceArea: dealer.serviceArea || "",
        taxCode: dealer.taxCode || "",
        citizenId: dealer.citizenId || "",
        bankAccount: dealer.bankAccount || "",
        accountHolder: dealer.accountHolder || "",
        bankName: dealer.bankName || "",
        videoName: dealer.videoName || "",
      });
    } catch (caught) {
      setNotice({ kind: "error", text: caught instanceof Error ? caught.message : "Không tải được đại lý" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/dealers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không lưu được hồ sơ");
      setNotice({ kind: "success", text: result.message });
      await load();
    } catch (caught) {
      setNotice({ kind: "error", text: caught instanceof Error ? caught.message : "Không lưu được hồ sơ" });
    } finally {
      setSaving(false);
    }
  }

  const setValue = (name: string, value: string) => setForm((current) => ({ ...current, [name]: value }));
  const field = (name: string, label: string, type = "text") => <label className="min-w-0"><span className="field-label">{label}</span><input type={type} value={String(form[name] ?? "")} onChange={(event) => setValue(name, event.target.value)}/></label>;
  const photos = data ? [
    { label: "Ảnh chân dung", url: data.portraitPhoto, icon: "user" as const },
    { label: "Ảnh cửa hàng", url: data.storePhoto, icon: "store" as const },
    { label: "Ảnh kho", url: data.warehousePhoto, icon: "building" as const },
  ] : [];

  return <main className="min-h-screen">
    <OperationsHeader
      title={data ? `${data.dealerCode} · ${data.name}` : "Chi tiết đại lý"}
      subtitle="Toàn bộ thông tin đại lý/CTV đã điền trên Form đăng ký, mã CRM, tài khoản, lệnh và đối soát"
      actions={<Link href="/admin/dealers" className="btn-secondary"><Icon name="store" size={16}/>Danh sách đại lý</Link>}
    />
    <div className="page-container space-y-6">
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      {loading && !data ? <LoadingState label="Đang tải hồ sơ đại lý..."/> : data && <>
        <section className="order-detail-hero">
          <div className="min-w-0">
            <p className="section-kicker">Hồ sơ đăng ký đại lý / CTV</p>
            <h1 className="mt-2 break-words text-2xl font-black text-slate-950 sm:text-3xl">{data.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2"><span className="mini-chip mini-chip--green">Mã CRM: {data.dealerCode}</span><span className="mini-chip"><Icon name="phone" size={13}/>{data.phone}</span><StatusBadge value={data.status}/></div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">Mã đại lý đồng thời là mã đăng nhập và phải trùng mã khách hàng trên CRM. Hệ thống không tự sinh mã.</p>
          </div>
          <div className="summary-grid">
            <div><span>Lệnh dịch vụ</span><strong>{data.serviceOrders.length}</strong></div>
            <div><span>Ticket</span><strong>{data.supportTickets.length}</strong></div>
            <div><span>Đối soát</span><strong>{data.paymentBatches.length}</strong></div>
            <div><span>Ngày đăng ký</span><strong className="text-sm">{displayDate(data.createdAt)}</strong></div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
          <form onSubmit={save} className="surface-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="page-section-title">Xem / sửa toàn bộ thông tin đăng ký</h2><p className="page-section-subtitle">Đổi mã đại lý sẽ đồng bộ mã trên tài khoản Đại lý, CTV và KTV liên quan.</p></div>
              <button disabled={saving} className="btn-primary px-5 py-3 font-black text-white disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>
            </div>

            <div className="mt-6 form-grid">
              <div className="span-4">{field("dealerCode", "Mã đại lý / mã CRM")}</div>
              <div className="span-4">{field("registrationType", "Loại đăng ký")}</div>
              <div className="span-4">{field("locationType", "Loại địa điểm")}</div>
              <div className="span-6">{field("name", "Tên hiển thị đại lý")}</div>
              <div className="span-6">{field("companyName", "Tên công ty / cửa hàng")}</div>
              <div className="span-4">{field("representativeName", "Người đại diện")}</div>
              <div className="span-4">{field("phone", "Số điện thoại")}</div>
              <div className="span-4">{field("birthDate", "Ngày sinh", "date")}</div>
              <div className="span-6">{field("email", "Email", "email")}</div>
              <div className="span-6">{field("province", "Tỉnh / Thành")}</div>
              <div className="span-8">{field("address", "Địa chỉ đầy đủ")}</div>
              <div className="span-4">{field("serviceArea", "Khu vực phụ trách")}</div>
              <div className="span-4">{field("technicianCount", "Số kỹ thuật viên", "number")}</div>
              <div className="span-4">{field("taxCode", "Mã số thuế")}</div>
              <div className="span-4">{field("citizenId", "CCCD")}</div>
              <div className="span-4">{field("bankAccount", "Số tài khoản")}</div>
              <div className="span-4">{field("accountHolder", "Chủ tài khoản")}</div>
              <div className="span-4">{field("bankName", "Ngân hàng")}</div>
              <div className="span-4">{field("videoName", "Tên file video đăng ký")}</div>
              <label className="span-12"><span className="field-label">Năng lực và dịch vụ có thể thực hiện</span><textarea rows={5} value={String(form.services ?? "")} onChange={(event) => setValue("services", event.target.value)}/></label>
            </div>
          </form>

          <aside className="space-y-6">
            <section className="surface-card overflow-hidden">
              <div className="data-toolbar"><div><h2 className="page-section-title">Ảnh và vị trí đã đăng ký</h2><p className="page-section-subtitle">Dữ liệu trả về đúng từ Form đăng ký.</p></div></div>
              <div className="space-y-3 p-4">
                {photos.map((photo) => photo.url ? <a key={photo.label} href={photo.url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="h-36 bg-cover bg-center transition duration-300 group-hover:scale-[1.02]" style={{ backgroundImage: `url(${photo.url})` }}/>
                  <div className="flex items-center justify-between gap-3 p-3"><span className="inline-flex items-center gap-2 font-extrabold"><Icon name={photo.icon} size={16}/>{photo.label}</span><Icon name="eye" size={16}/></div>
                </a> : <div key={photo.label} className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm font-bold text-slate-500">Chưa có {photo.label.toLowerCase()}.</div>)}
                {data.lat != null && data.lng != null ? <a href={`https://www.google.com/maps?q=${data.lat},${data.lng}`} target="_blank" rel="noreferrer" className="btn-secondary w-full"><Icon name="map-pin" size={16}/>Mở vị trí GPS ({data.lat.toFixed(5)}, {data.lng.toFixed(5)})</a> : <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-700">Chưa có tọa độ GPS.</p>}
              </div>
            </section>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="surface-card overflow-hidden">
            <div className="data-toolbar"><div><h2 className="page-section-title">Lệnh dịch vụ gần nhất</h2><p className="page-section-subtitle">Bấm từng lệnh để xem chi tiết và báo cáo kỹ thuật.</p></div></div>
            <div className="divide-y">{data.serviceOrders.slice(0, 20).map((order) => <Link href={`/admin/service-orders/${order.id}`} key={order.id} className="block p-4 transition hover:bg-emerald-50/60"><div className="flex flex-wrap justify-between gap-2"><strong>{order.orderCode}</strong><StatusBadge value={order.status}/></div><p className="mt-1 text-sm text-slate-600">{order.customerName} · {order.serviceType}</p></Link>)}{!data.serviceOrders.length && <div className="empty-state"><p className="font-bold">Chưa có lệnh dịch vụ.</p></div>}</div>
          </article>
          <article className="surface-card overflow-hidden">
            <div className="data-toolbar"><div><h2 className="page-section-title">Yêu cầu liên quan</h2><p className="page-section-subtitle">Mở đúng Ticket để xem “Mô tả lại yêu cầu” và lệnh Điều phối.</p></div></div>
            <div className="divide-y">{data.supportTickets.slice(0, 20).map((ticket) => <Link href={`/admin/tickets?ticket=${ticket.id}`} key={ticket.id} className="block p-4 transition hover:bg-emerald-50/60"><div className="flex flex-wrap justify-between gap-2"><strong>{ticket.ticketCode}</strong><StatusBadge value={ticket.status}/></div><p className="mt-1 text-sm text-slate-600">{ticket.subject}</p></Link>)}{!data.supportTickets.length && <div className="empty-state"><p className="font-bold">Chưa có Ticket.</p></div>}</div>
          </article>
        </section>
      </>}
    </div>
  </main>;
}
