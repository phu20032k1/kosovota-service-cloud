"use client";

import { FormEvent, useEffect, useState } from "react";
import { PortalHeader } from "@/components/ui/PortalHeader";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";

type Dealer = { dealerCode: string; name: string; phone: string; address?: string | null; services?: string | null; lat?: number | null; lng?: number | null };

export default function DealerProfilePage() {
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [form, setForm] = useState({ address: "", services: "", lat: "", lng: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => { void load(); }, []);
  async function load() {
    try {
      const response = await fetch("/api/agent-portal/profile", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được hồ sơ");
      const item = result.data as Dealer; setDealer(item);
      setForm({ address: item.address || "", services: item.services || "", lat: item.lat == null ? "" : String(item.lat), lng: item.lng == null ? "" : String(item.lng) });
    } catch (e) { setNotice({ kind: "error", text: e instanceof Error ? e.message : "Không tải được hồ sơ" }); }
  }
  function getGps() {
    if (!navigator.geolocation) return setNotice({ kind: "error", text: "Thiết bị này không hỗ trợ GPS." });
    setBusy(true); setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (position) => { setForm((current) => ({ ...current, lat: position.coords.latitude.toFixed(6), lng: position.coords.longitude.toFixed(6) })); setNotice({ kind: "success", text: "Đã lấy vị trí hiện tại. Hãy bấm Lưu hồ sơ." }); setBusy(false); },
      () => { setNotice({ kind: "error", text: "Không lấy được GPS. Hãy cho phép quyền vị trí rồi thử lại." }); setBusy(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/agent-portal/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || "Không lưu được hồ sơ");
      setNotice({ kind: "success", text: result.message }); await load();
    } catch (e) { setNotice({ kind: "error", text: e instanceof Error ? e.message : "Không lưu được hồ sơ" }); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-100"><PortalHeader title="Hồ sơ đại lý" subtitle={dealer ? `${dealer.dealerCode} · ${dealer.name}` : "Địa chỉ, dịch vụ và GPS cửa hàng"} homeHref="/agent-portal" homeLabel="Lệnh của tôi" onLogout={() => fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"))}/><div className="mx-auto max-w-xl p-3 sm:p-6"><form onSubmit={save} className="surface-card p-5 sm:p-6">{notice&&<div className="mb-5"><Notice kind={notice.kind}>{notice.text}</Notice></div>}<div className="rounded-2xl bg-slate-50 p-4 text-sm"><p><strong>Tên:</strong> {dealer?.name || "—"}</p><p className="mt-1"><strong>SĐT:</strong> {dealer?.phone || "—"}</p></div><label className="mt-5 block"><span className="field-label">Địa chỉ cửa hàng *</span><textarea rows={3} value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})} required className="w-full"/></label><label className="mt-4 block"><span className="field-label">Dịch vụ cung cấp</span><textarea rows={3} value={form.services} onChange={(e)=>setForm({...form,services:e.target.value})} placeholder="Lắp đặt, thay lõi, sửa chữa, bảo hành..." className="w-full"/></label><div className="mt-4 grid grid-cols-2 gap-3"><label><span className="field-label">Latitude</span><input value={form.lat} onChange={(e)=>setForm({...form,lat:e.target.value})} inputMode="decimal"/></label><label><span className="field-label">Longitude</span><input value={form.lng} onChange={(e)=>setForm({...form,lng:e.target.value})} inputMode="decimal"/></label></div><button type="button" disabled={busy} onClick={getGps} className="btn-secondary mt-4 w-full p-3"><Icon name="map-pin" size={17}/>Lấy GPS khi đang ở cửa hàng</button><button type="submit" disabled={busy} className="btn-primary mt-3 w-full p-3 font-black text-white disabled:opacity-50">{busy?"Đang lưu...":"Lưu hồ sơ"}</button></form></div></main>;
}
