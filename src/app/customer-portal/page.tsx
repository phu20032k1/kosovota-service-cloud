"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PortalHeader } from "@/components/ui/PortalHeader";
import { Brand } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { SmartBackButton } from "@/components/ui/SmartBackButton";

type Schedule = { id: string; title: string; dueDate: string; status: string };
type Report = {
  id: string;
  serviceType: string;
  products?: string | null;
  oldCorePhoto?: string | null;
  newCorePhoto?: string | null;
  finalPhoto?: string | null;
  note?: string | null;
  createdAt: string;
};
type SosTicket = { id: string; status: string; createdAt: string; note?: string | null };
type Machine = {
  id: string;
  model: string;
  serial?: string | null;
  installDate?: string | null;
  manufactureDate?: string | null;
  status: string;
  buildingPhoto?: string | null;
  machinePhoto?: string | null;
  customer?: { phone: string } | null;
  maintenanceSchedules: Schedule[];
  serviceReports: Report[];
  sosTickets: SosTicket[];
};
type Customer = {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  notifyChannels?: string | null;
  callFrom?: string | null;
  callTo?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleDateString("vi-VN");
}

function statusLabel(status: string) {
  return ({
    ACTIVE: "Đang hoạt động",
    ACTIVE_WARNING: "Cần theo dõi",
    NEEDS_SUPPORT: "Cần hỗ trợ",
    INACTIVE: "Ngừng sử dụng",
    PENDING: "Sắp tới",
    COMPLETED: "Đã hoàn thành",
  } as Record<string, string>)[status] || status;
}

export default function CustomerPortalPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [authStep, setAuthStep] = useState<"phone" | "otp">("phone");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [notifyChannels, setNotifyChannels] = useState<string[]>(["Zalo"]);
  const [callFrom, setCallFrom] = useState("09:00");
  const [callTo, setCallTo] = useState("11:00");
  const [relativePhone, setRelativePhone] = useState("");
  const [shareOtp, setShareOtp] = useState("");
  const [shareStep, setShareStep] = useState<"phone" | "otp">("phone");
  const [sosNote, setSosNote] = useState("");
  const [showSos, setShowSos] = useState(false);

  const selectedMachine = useMemo(
    () => machines.find((machine) => machine.id === selectedId) || machines[0] || null,
    [machines, selectedId],
  );

  const isOwner = Boolean(selectedMachine?.customer?.phone && selectedMachine.customer.phone === customer?.phone);

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch("/api/customer-portal", { cache: "no-store" });
      const result = await response.json();
      if (response.status === 401) {
        setAuthenticated(false);
        setCustomer(null);
        setMachines([]);
        return;
      }
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được dữ liệu.");

      setAuthenticated(true);
      setCustomer(result.customer);
      const loadedMachines = result.machines || [];
      setMachines(loadedMachines);
      const requestedMachineId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("machineId") : null;
      setSelectedId((current) => current || (requestedMachineId && loadedMachines.some((item: Machine) => item.id === requestedMachineId) ? requestedMachineId : loadedMachines[0]?.id || ""));
      setNotifyChannels(result.customer?.notifyChannels?.split(",").filter(Boolean) || ["Zalo"]);
      setCallFrom(result.customer?.callFrom || "09:00");
      setCallTo(result.customer?.callTo || "11:00");
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được dữ liệu." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch("/api/customer-auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không gửi được OTP.");
      if (result.debugCode) setOtp(result.debugCode);
      setAuthStep("otp");
      setNotice({ kind: "ok", text: result.message });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không gửi được OTP." });
    } finally { setLoading(false); }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch("/api/customer-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "OTP không hợp lệ.");
      setOtp("");
      await loadData();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "OTP không hợp lệ." });
    } finally { setLoading(false); }
  }

  async function logout() {
    await fetch("/api/customer-auth/logout", { method: "POST" });
    setAuthenticated(false);
    setCustomer(null);
    setMachines([]);
    setAuthStep("phone");
  }

  async function createSosTicket() {
    if (!selectedMachine || !customer) return;
    setLoading(true);
    try {
      const response = await fetch("/api/sos-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId: selectedMachine.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          address: customer.address,
          note: sosNote,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không gửi được SOS.");
      setNotice({ kind: "ok", text: result.message });
      setShowSos(false);
      setSosNote("");
      await loadData();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không gửi được SOS." });
    } finally { setLoading(false); }
  }

  async function saveNotificationSettings() {
    setLoading(true);
    try {
      const response = await fetch("/api/customer-portal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyChannels, callFrom, callTo }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không lưu được cài đặt.");
      setNotice({ kind: "ok", text: result.message });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không lưu được cài đặt." });
    } finally { setLoading(false); }
  }

  async function requestShareOtp() {
    if (!selectedMachine || !relativePhone) return;
    setLoading(true);
    try {
      const response = await fetch("/api/customer-portal/share-machine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId: selectedMachine.id, relativePhone }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không gửi được mã xác nhận.");
      if (result.debugCode) setShareOtp(result.debugCode);
      setShareStep("otp");
      setNotice({ kind: "ok", text: result.message });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không gửi được mã xác nhận." });
    } finally { setLoading(false); }
  }

  async function confirmShare() {
    if (!selectedMachine) return;
    setLoading(true);
    try {
      const response = await fetch("/api/customer-portal/share-machine", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId: selectedMachine.id, relativePhone, otp: shareOtp }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không xác nhận được chia sẻ.");
      setNotice({ kind: "ok", text: result.message });
      setRelativePhone("");
      setShareOtp("");
      setShareStep("phone");
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không xác nhận được chia sẻ." });
    } finally { setLoading(false); }
  }

  if (authenticated === null || (loading && authenticated === null)) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 font-bold text-slate-600">Đang tải cổng khách hàng...</main>;
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 to-emerald-950 px-4 py-10">
        <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white p-7 shadow-2xl sm:p-9">
          <div className="text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.4rem] bg-emerald-100 text-emerald-700 shadow-sm"><Icon name="user" size={36}/></div>
            <div className="mt-5 flex justify-center"><Brand compact/></div><p className="mt-4 text-sm font-black uppercase tracking-[0.25em] text-emerald-700">KOSOVOTA</p>
            <h1 className="mt-2 text-2xl font-black">Cổng thông tin khách hàng</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Đăng nhập bằng số điện thoại đã kích hoạt máy hoặc được chủ máy chia sẻ.</p>
          </div>
          {notice && <div className={`mt-5 rounded-xl px-4 py-3 text-sm font-bold ${notice.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{notice.text}</div>}
          {authStep === "phone" ? (
            <form onSubmit={requestOtp} className="mt-6 space-y-4">
              <input className="form-input" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="Số điện thoại" required />
              <button disabled={loading} className="w-full rounded-xl bg-emerald-600 px-5 py-4 font-black text-white disabled:opacity-60">GỬI MÃ OTP</button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="mt-6 space-y-4">
              <input className="form-input text-center text-xl tracking-[0.3em]" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="••••••" required />
              <button disabled={loading} className="w-full rounded-xl bg-emerald-600 px-5 py-4 font-black text-white disabled:opacity-60">XÁC NHẬN & ĐĂNG NHẬP</button>
              <button type="button" onClick={() => setAuthStep("phone")} className="w-full text-sm font-bold text-slate-500">Đổi số điện thoại</button>
            </form>
          )}
          <div className="mt-6 text-center"><SmartBackButton className="text-sm font-bold text-slate-500 hover:text-emerald-700" fallbackHref="/login" /></div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <PortalHeader title="Cổng thông tin khách hàng" subtitle={customer ? `${customer.name} · ${customer.phone}` : undefined} homeHref="/customer-portal" homeLabel="Máy của tôi" onLogout={logout} />

      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {notice && <Notice kind={notice.kind === "ok" ? "success" : "error"}>{notice.text}</Notice>}

        <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="surface-card h-fit space-y-5 p-5 lg:sticky lg:top-24">
            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Khách hàng</p>
              <h2 className="mt-2 text-xl font-black">{customer?.name}</h2>
              <p className="mt-1 text-sm text-white/70">{customer?.phone}</p>
              <p className="mt-2 text-sm leading-6 text-white/70">{customer?.address || "Tài khoản được chia sẻ máy"}</p>
            </div>
            <div>
              <p className="mb-3 font-black">Thiết bị của tôi</p>
              <div className="space-y-2">
                {machines.map((machine) => (
                  <button type="button" key={machine.id} onClick={() => setSelectedId(machine.id)} className={`w-full rounded-xl border p-4 text-left ${selectedMachine?.id === machine.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`}>
                    <p className="font-black">{machine.id}</p>
                    <p className="mt-1 text-xs text-slate-500">{machine.model} · {statusLabel(machine.status)}</p>
                  </button>
                ))}
                {machines.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có máy được liên kết.</p>}
              </div>
            </div>
          </aside>

          {selectedMachine && (
            <section className="space-y-6">
              <article className="surface-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Thông tin máy</p>
                    <h2 className="mt-2 text-2xl font-black">{selectedMachine.id}</h2>
                    <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p><strong>Model:</strong> {selectedMachine.model}</p>
                      <p><strong>Seri:</strong> {selectedMachine.serial || "Chưa cập nhật"}</p>
                      <p><strong>Ngày lắp:</strong> {formatDate(selectedMachine.installDate)}</p>
                      <p><strong>Trạng thái:</strong> {statusLabel(selectedMachine.status)}</p>
                    </div>
                  </div>
                  {isOwner && <button type="button" onClick={() => setShowSos(true)} className="rounded-xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-700">SOS – MÁY HỎNG</button>}
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Photo url={selectedMachine.buildingPhoto} label="Ảnh tòa nhà / mặt tiền" />
                  <Photo url={selectedMachine.machinePhoto} label="Ảnh vị trí máy" />
                </div>
              </article>

              <div className="grid gap-6 xl:grid-cols-2">
                <article className="surface-card p-6">
                  <h3 className="text-xl font-black">Lịch bảo trì sắp tới</h3>
                  <div className="mt-5 space-y-3">
                    {selectedMachine.maintenanceSchedules.filter((item) => item.status !== "COMPLETED").map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                        <div><p className="font-bold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{statusLabel(item.status)}</p></div>
                        <p className="shrink-0 font-black text-emerald-700">{formatDate(item.dueDate)}</p>
                      </div>
                    ))}
                    {selectedMachine.maintenanceSchedules.filter((item) => item.status !== "COMPLETED").length === 0 && <p className="text-sm text-slate-500">Chưa có lịch bảo trì sắp tới.</p>}
                  </div>
                </article>

                <article className="surface-card p-6">
                  <h3 className="text-xl font-black">Yêu cầu hỗ trợ gần đây</h3>
                  <div className="mt-5 space-y-3">
                    {selectedMachine.sosTickets.map((ticket) => (
                      <div key={ticket.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex justify-between gap-3"><p className="font-bold">{formatDate(ticket.createdAt)}</p><span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">{ticket.status}</span></div>
                        <p className="mt-2 text-sm text-slate-600">{ticket.note || "Yêu cầu kiểm tra máy"}</p>
                      </div>
                    ))}
                    {selectedMachine.sosTickets.length === 0 && <p className="text-sm text-slate-500">Chưa có yêu cầu SOS.</p>}
                  </div>
                </article>
              </div>

              <article className="surface-card p-6">
                <h3 className="text-xl font-black">Lịch sử dịch vụ</h3>
                <div className="mt-5 space-y-5">
                  {selectedMachine.serviceReports.map((report) => (
                    <div key={report.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap justify-between gap-2"><p className="font-black">{report.serviceType}</p><p className="text-sm font-bold text-slate-500">{formatDate(report.createdAt)}</p></div>
                      <p className="mt-2 text-sm text-slate-600">Sản phẩm thay thế: {report.products || "Không phát sinh"}</p>
                      {report.note && <p className="mt-1 text-sm text-slate-600">Ghi chú: {report.note}</p>}
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <Photo url={report.oldCorePhoto} label="Lõi cũ" compact />
                        <Photo url={report.newCorePhoto} label="Lõi mới" compact />
                        <Photo url={report.finalPhoto} label="Hoàn thành" compact />
                      </div>
                    </div>
                  ))}
                  {selectedMachine.serviceReports.length === 0 && <p className="text-sm text-slate-500">Chưa có báo cáo dịch vụ.</p>}
                </div>
              </article>

              {isOwner && (
                <div className="grid gap-6 xl:grid-cols-2">
                  <article className="surface-card p-6">
                    <h3 className="text-xl font-black">Cài đặt nhận thông báo</h3>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      {["Zalo", "SMS", "Email"].map((channel) => (
                        <label key={channel} className="flex items-center gap-2 rounded-xl border p-3 text-sm font-bold">
                          <input type="checkbox" checked={notifyChannels.includes(channel)} onChange={(e) => setNotifyChannels((current) => e.target.checked ? [...new Set([...current, channel])] : current.filter((item) => item !== channel))} /> {channel}
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <label className="text-sm font-bold">Được gọi từ<input type="time" value={callFrom} onChange={(e) => setCallFrom(e.target.value)} className="form-input mt-2" /></label>
                      <label className="text-sm font-bold">Đến<input type="time" value={callTo} onChange={(e) => setCallTo(e.target.value)} className="form-input mt-2" /></label>
                    </div>
                    <button type="button" onClick={saveNotificationSettings} disabled={loading} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-60">LƯU CÀI ĐẶT</button>
                  </article>

                  <article className="surface-card p-6">
                    <h3 className="text-xl font-black">Chia sẻ máy cho người thân</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Người thân đăng nhập bằng OTP và chỉ xem được máy đã chia sẻ.</p>
                    {shareStep === "phone" ? (
                      <div className="mt-5 flex gap-3">
                        <input value={relativePhone} onChange={(e) => setRelativePhone(e.target.value.replace(/\D/g, ""))} placeholder="Số điện thoại người thân" className="form-input" />
                        <button type="button" onClick={requestShareOtp} disabled={loading} className="shrink-0 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-60">GỬI OTP</button>
                      </div>
                    ) : (
                      <div className="mt-5 space-y-3">
                        <input value={shareOtp} onChange={(e) => setShareOtp(e.target.value.replace(/\D/g, ""))} maxLength={6} placeholder="Mã OTP của chủ máy" className="form-input text-center tracking-[0.25em]" />
                        <div className="flex gap-3"><button type="button" onClick={confirmShare} disabled={loading} className="flex-1 rounded-xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-60">XÁC NHẬN CHIA SẺ</button><button type="button" onClick={() => setShareStep("phone")} className="rounded-xl border px-4 font-bold">Hủy</button></div>
                      </div>
                    )}
                  </article>
                </div>
              )}
            </section>
          )}
        </section>
      </div>

      {showSos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-black text-red-700">Yêu cầu sửa máy khẩn cấp</h2>
            <p className="mt-2 text-sm text-slate-500">Máy: {selectedMachine?.id}</p>
            <textarea value={sosNote} onChange={(e) => setSosNote(e.target.value)} className="form-input mt-5 min-h-32" placeholder="Mô tả tình trạng máy, tiếng kêu, rò nước hoặc mã lỗi..." />
            <div className="mt-5 flex gap-3"><button type="button" onClick={createSosTicket} disabled={loading} className="flex-1 rounded-xl bg-red-600 px-5 py-3 font-black text-white disabled:opacity-60">GỬI YÊU CẦU SOS</button><button type="button" onClick={() => setShowSos(false)} className="rounded-xl border px-5 font-bold">Đóng</button></div>
          </div>
        </div>
      )}
    </main>
  );
}

function Photo({ url, label, compact = false }: { url?: string | null; label: string; compact?: boolean }) {
  if (!url) return <div className={`${compact ? "h-28" : "h-48"} flex items-center justify-center rounded-xl bg-slate-100 text-center text-xs font-bold text-slate-400`}>{label}<br />Chưa có ảnh</div>;
  return <a href={url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl bg-slate-100"><img src={url} alt={label} className={`${compact ? "h-28" : "h-48"} w-full object-cover transition group-hover:scale-105`} /><span className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-xs font-bold text-white">{label}</span></a>;
}
