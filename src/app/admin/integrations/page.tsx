"use client";

import { useEffect, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";

type State = {
  map: { provider: string; ready: boolean; browserKeyConfigured: boolean };
  geocoding: { enabled: boolean; provider: string; ready: boolean };
  notifications: { dryRun: boolean; otpChannel: string };
  sms: { provider: string; ready: boolean; sandbox: boolean };
  zalo: { provider: string; ready: boolean; otpTemplate: boolean; serviceOrderTemplate: boolean };
  email: { ready: boolean; from: string };
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
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được cấu hình.");
      setData(result.data);
    }).catch((value) => setError(value instanceof Error ? value.message : "Không tải được cấu hình."));
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
      if (!response.ok || !result.success) throw new Error(result.message || "Kiểm thử thất bại.");
      const extra = kind === "map" && result.data
        ? ` Tọa độ: ${Number(result.data.lat).toFixed(6)}, ${Number(result.data.lng).toFixed(6)}.`
        : "";
      setNotice({ kind: result.data?.dryRun ? "info" : "success", text: `${result.message}${extra}` });
    } catch (value) {
      setNotice({ kind: "error", text: value instanceof Error ? value.message : "Kiểm thử thất bại." });
    } finally {
      setTesting(null);
    }
  }

  return <main className="min-h-screen bg-slate-50">
    <OperationsHeader title="Tích hợp dịch vụ" subtitle="Theo dõi và kiểm thử Map, SMS, Zalo, Gmail, OTP" />
    <section className="mx-auto max-w-[1480px] space-y-5 p-3 sm:p-5">
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      {!data ? <LoadingState label="Đang kiểm tra cấu hình..." /> : <>
        {data.notifications.dryRun && <Notice kind="warning">Hệ thống đang ở chế độ DRY RUN: SMS/Zalo/Gmail chỉ được mô phỏng. Sau khi sandbox thành công, đổi <code>NOTIFICATION_DRY_RUN=false</code> để gửi thật.</Notice>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <IntegrationCard icon="map" title="Bản đồ" provider={data.map.provider} ready={data.map.ready} rows={[["Khóa trình duyệt", data.map.browserKeyConfigured]]} />
          <IntegrationCard icon="map-pin" title="Geocoding địa chỉ" provider={data.geocoding.provider} ready={data.geocoding.enabled && data.geocoding.ready} rows={[["Đã bật tự động", data.geocoding.enabled], ["Khóa server", data.geocoding.ready]]} />
          <IntegrationCard icon="phone" title="SMS" provider={data.sms.provider} ready={data.sms.ready && !data.sms.sandbox && !data.notifications.dryRun} rows={[["Thông tin API", data.sms.ready], ["Sandbox đã tắt", !data.sms.sandbox], ["Gửi thật đã bật", !data.notifications.dryRun]]} />
          <IntegrationCard icon="send" title="Zalo ZBS Template" provider={data.zalo.provider} ready={data.zalo.ready && !data.notifications.dryRun} rows={[["Access token + template", data.zalo.ready], ["Template OTP", data.zalo.otpTemplate], ["Template giao lệnh", data.zalo.serviceOrderTemplate]]} />
          <IntegrationCard icon="file" title="Gmail thông báo" provider="smtp.gmail.com:587" ready={data.email.ready && !data.notifications.dryRun} rows={[["GMAIL_USER + APP_PASSWORD", data.email.ready], ["Gửi thật đã bật", !data.notifications.dryRun]]} />
          <IntegrationCard icon="shield" title="OTP" provider={data.notifications.otpChannel} ready={!data.notifications.dryRun && (data.notifications.otpChannel === "ZALO" ? data.zalo.ready : data.sms.ready)} rows={[["Kênh hiện tại", true], ["Gửi thật đã bật", !data.notifications.dryRun]]} />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="surface-card p-5 sm:p-6">
            <div className="flex items-start gap-4"><span className="metric-icon metric-emerald"><Icon name="map-pin" size={21}/></span><div><h2 className="text-lg font-extrabold">Test Map / Geocoding</h2><p className="mt-1 text-sm leading-6 text-slate-500">Nhập địa chỉ thật rồi bấm kiểm tra. OSM chỉ hiển thị bản đồ; chức năng đổi địa chỉ thành tọa độ cần MapTiler hoặc Google.</p></div></div>
            <input value={address} onChange={(event) => setAddress(event.target.value)} className="form-input mt-5" placeholder="Ví dụ: 1 Tràng Tiền, Hoàn Kiếm, Hà Nội" />
            <button type="button" onClick={() => void testIntegration("map")} disabled={testing !== null} className="btn-primary mt-3 w-full justify-center p-3 font-extrabold text-white disabled:opacity-50"><Icon name={testing === "map" ? "refresh" : "map"} size={18}/> {testing === "map" ? "Đang kiểm tra..." : "Kiểm tra Map"}</button>
          </section>

          <section className="surface-card p-5 sm:p-6">
            <div className="flex items-start gap-4"><span className="metric-icon metric-blue"><Icon name="phone" size={21}/></span><div><h2 className="text-lg font-extrabold">Test SMS / Zalo / Gmail</h2><p className="mt-1 text-sm leading-6 text-slate-500">Dùng số điện thoại/email của chính cậu. Với Zalo, template test phải có đúng các biến đã khai báo trong <code>ZALO_ZBS_TEST_TEMPLATE_DATA</code>.</p></div></div>
            <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^0-9+]/g, ""))} className="form-input mt-5" placeholder="09xxxxxxxx" />
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="form-input mt-3" placeholder="email-test@gmail.com" />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => void testIntegration("sms")} disabled={testing !== null} className="btn-primary justify-center p-3 font-extrabold text-white disabled:opacity-50"><Icon name={testing === "sms" ? "refresh" : "phone"} size={18}/> {testing === "sms" ? "Đang gửi..." : "Test SMS"}</button>
              <button type="button" onClick={() => void testIntegration("zalo")} disabled={testing !== null} className="btn-secondary justify-center p-3 font-extrabold disabled:opacity-50"><Icon name={testing === "zalo" ? "refresh" : "send"} size={18}/> {testing === "zalo" ? "Đang gửi..." : "Test Zalo"}</button>
              <button type="button" onClick={() => void testIntegration("email")} disabled={testing !== null} className="btn-secondary justify-center p-3 font-extrabold disabled:opacity-50"><Icon name={testing === "email" ? "refresh" : "file"} size={18}/> {testing === "email" ? "Đang gửi..." : "Test Gmail"}</button>
            </div>
          </section>
        </div>

        <div className="surface-card p-5 sm:p-6">
          <div className="flex items-start gap-4"><span className="metric-icon metric-emerald"><Icon name="settings" size={21}/></span><div><h2 className="text-lg font-extrabold">Cấu hình ở đâu?</h2><p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">Mở file <code>.env</code>, điền khóa dịch vụ rồi khởi động lại <code>npm run dev</code>. Hướng dẫn cầm tay chỉ việc nằm trong <code>HUONG_DAN_QR_MAP_SMS_ZALO_V19.md</code>. Trang quét camera ở <code>/scan</code>.</p></div></div>
        </div>
      </>}
    </section>
  </main>;
}

function IntegrationCard({ icon, title, provider, ready, rows }: { icon: IconName; title: string; provider: string; ready: boolean; rows: Array<[string, boolean]> }) {
  return <article className="surface-card p-5"><div className="flex items-start justify-between gap-3"><span className={`metric-icon ${ready ? "metric-emerald" : "metric-amber"}`}><Icon name={icon} size={21}/></span><span className={`status-pill ${ready ? "status-green" : "status-amber"}`}><Icon name={ready ? "check" : "clock"} size={13}/>{ready ? "Sẵn sàng" : "Chưa hoàn tất"}</span></div><h2 className="mt-4 text-lg font-extrabold">{title}</h2><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">Provider: {provider}</p><div className="mt-4 space-y-2">{rows.map(([label, ok]) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"><span className="text-slate-600">{label}</span><Icon name={ok ? "check" : "x"} size={17} className={ok ? "text-emerald-600" : "text-rose-500"}/></div>)}</div></article>;
}
