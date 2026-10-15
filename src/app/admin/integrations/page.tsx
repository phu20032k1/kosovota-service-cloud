"use client";

import { useEffect, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";

type State = {
  map: { ready: boolean; browserKeyConfigured: boolean };
  geocoding: { enabled: boolean; ready: boolean };
  notifications: { dryRun: boolean; otpChannel: string };
  sms: { ready: boolean; sandbox: boolean };
  zalo: { ready: boolean; otpTemplate: boolean; serviceOrderTemplate: boolean };
  email: { ready: boolean; dryRun: boolean };
};

type TestKind = "map" | "sms" | "zalo" | "email";

export default function IntegrationsPage() {
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [address, setAddress] = useState("Hồ Hoàn Kiếm, Hà Nội");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [testing, setTesting] = useState<TestKind | null>(null);

  useEffect(() => {
    fetch("/api/admin/integrations").then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được trạng thái dịch vụ.");
      setData(result.data);
    }).catch((value) => setError(value instanceof Error ? value.message : "Không tải được trạng thái dịch vụ."));
  }, []);

  async function testIntegration(kind: TestKind) {
    setTesting(kind);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, address, phone, email }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Kiểm tra thất bại.");
      const extra = kind === "map" && result.data
        ? ` Tọa độ: ${Number(result.data.lat).toFixed(6)}, ${Number(result.data.lng).toFixed(6)}.${result.data.formattedAddress ? ` Địa chỉ chuẩn: ${result.data.formattedAddress}.` : ""}${result.data.provinceName ? ` Tỉnh/thành: ${result.data.provinceName}.` : ""}`
        : "";
      setNotice({ kind: result.data?.dryRun ? "info" : "success", text: `${result.message}${extra}` });
    } catch (value) {
      setNotice({ kind: "error", text: value instanceof Error ? value.message : "Kiểm tra thất bại." });
    } finally {
      setTesting(null);
    }
  }

  return <main className="min-h-screen bg-slate-50">
    <OperationsHeader title="Tích hợp dịch vụ" subtitle="Theo dõi trạng thái bản đồ, SMS, Zalo, Gmail và mã xác thực" />
    <section className="mx-auto max-w-[1480px] space-y-4 p-3 sm:space-y-5 sm:p-5">
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      {!data ? <LoadingState label="Đang kiểm tra trạng thái dịch vụ..." /> : <>
        {data.notifications.dryRun && <Notice kind="warning">SMS và Zalo đang ở chế độ kiểm tra, chưa gửi tin thật.</Notice>}
        {data.email.dryRun && <Notice kind="info">Gmail đang ở chế độ kiểm tra, chưa gửi email thật.</Notice>}

        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          <IntegrationCard icon="map" title="Bản đồ" ready={data.map.ready} rows={[["Hiển thị bản đồ", data.map.ready]]} />
          <IntegrationCard icon="map-pin" title="Định vị địa chỉ" ready={data.geocoding.enabled && data.geocoding.ready} rows={[["Tự động định vị", data.geocoding.enabled], ["Dịch vụ định vị", data.geocoding.ready]]} />
          <IntegrationCard icon="phone" title="SMS" ready={data.sms.ready && !data.sms.sandbox && !data.notifications.dryRun} rows={[["Kết nối dịch vụ", data.sms.ready], ["Gửi tin thật", !data.sms.sandbox && !data.notifications.dryRun]]} />
          <IntegrationCard icon="send" title="Zalo" ready={data.zalo.ready && !data.notifications.dryRun} rows={[["Kết nối dịch vụ", data.zalo.ready], ["Gửi mã xác thực", data.zalo.otpTemplate], ["Nhận lệnh dịch vụ", data.zalo.serviceOrderTemplate]]} />
          <IntegrationCard icon="file" title="Gmail" ready={data.email.ready && !data.email.dryRun} rows={[["Kết nối email", data.email.ready], ["Gửi email thật", !data.email.dryRun]]} />
          <IntegrationCard icon="shield" title="Mã xác thực" ready={!data.notifications.dryRun && (data.notifications.otpChannel === "ZALO" ? data.zalo.ready : data.sms.ready)} rows={[["Kênh gửi đang hoạt động", !data.notifications.dryRun], ["Sẵn sàng gửi mã", data.notifications.otpChannel === "ZALO" ? data.zalo.ready : data.sms.ready]]} />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="surface-card p-4 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="metric-icon metric-emerald"><Icon name="map-pin" size={21}/></span>
              <div>
                <h2 className="text-lg font-extrabold">Kiểm tra định vị</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">Nhập một địa chỉ để kiểm tra hệ thống có xác định đúng vị trí hay không.</p>
              </div>
            </div>
            <input value={address} onChange={(event) => setAddress(event.target.value)} className="form-input mt-5" autoComplete="street-address" enterKeyHint="search" placeholder="Ví dụ: 1 Tràng Tiền, Hoàn Kiếm, Hà Nội" />
            <button type="button" onClick={() => void testIntegration("map")} disabled={testing !== null} className="btn-primary mt-3 w-full justify-center p-3 font-extrabold text-white disabled:opacity-50"><Icon name={testing === "map" ? "refresh" : "map"} size={18}/> {testing === "map" ? "Đang kiểm tra..." : "Kiểm tra định vị"}</button>
          </section>

          <section className="surface-card p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="metric-icon metric-blue"><Icon name="phone" size={21}/></span>
              <div>
                <h2 className="text-lg font-extrabold">Kiểm tra gửi thông báo</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">Nhập số điện thoại hoặc email nhận thử, sau đó chọn kênh cần kiểm tra.</p>
              </div>
            </div>
            <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^0-9+]/g, ""))} className="form-input mt-5" placeholder="09xxxxxxxx" />
            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="form-input mt-3" placeholder="email@gmail.com" />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => void testIntegration("sms")} disabled={testing !== null} className="btn-primary justify-center p-3 font-extrabold text-white disabled:opacity-50"><Icon name={testing === "sms" ? "refresh" : "phone"} size={18}/> {testing === "sms" ? "Đang gửi..." : "Kiểm tra SMS"}</button>
              <button type="button" onClick={() => void testIntegration("zalo")} disabled={testing !== null} className="btn-secondary justify-center p-3 font-extrabold disabled:opacity-50"><Icon name={testing === "zalo" ? "refresh" : "send"} size={18}/> {testing === "zalo" ? "Đang gửi..." : "Kiểm tra Zalo"}</button>
              <button type="button" onClick={() => void testIntegration("email")} disabled={testing !== null} className="btn-secondary justify-center p-3 font-extrabold disabled:opacity-50"><Icon name={testing === "email" ? "refresh" : "file"} size={18}/> {testing === "email" ? "Đang gửi..." : "Kiểm tra Gmail"}</button>
            </div>
          </section>
        </div>
      </>}
    </section>
  </main>;
}

function IntegrationCard({ icon, title, ready, rows }: { icon: IconName; title: string; ready: boolean; rows: Array<[string, boolean]> }) {
  return <article className="surface-card p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <span className={`metric-icon ${ready ? "metric-emerald" : "metric-amber"}`}><Icon name={icon} size={21}/></span>
      <span className={`status-pill ${ready ? "status-green" : "status-amber"}`}><Icon name={ready ? "check" : "clock"} size={13}/>{ready ? "Sẵn sàng" : "Chưa hoàn tất"}</span>
    </div>
    <h2 className="mt-4 text-lg font-extrabold">{title}</h2>
    <div className="mt-4 space-y-2">
      {rows.map(([label, ok]) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"><span className="min-w-0 flex-1 break-words text-slate-600">{label}</span><Icon name={ok ? "check" : "x"} size={17} className={`shrink-0 ${ok ? "text-emerald-600" : "text-rose-500"}`}/></div>)}
    </div>
  </article>;
}
