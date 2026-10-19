"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import InteractiveMap, { type MapMarker } from "@/components/maps/InteractiveMap";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";

type DealerType = "commercial" | "service" | "freelancer";
type Dealer = {
  id: string;
  dealerCode: string;
  name: string;
  companyName?: string | null;
  representativeName?: string | null;
  birthDate?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  province?: string | null;
  locationType?: string | null;
  serviceArea?: string | null;
  services?: string | null;
  technicianCount?: number | null;
  rating?: number | null;
  registrationType?: string | null;
  lat?: number | null;
  lng?: number | null;
  portraitPhoto?: string | null;
  storePhoto?: string | null;
  warehousePhoto?: string | null;
  status: string;
};

type GpsSyncBatch = {
  scanned: number;
  attempted: number;
  updated: number;
  skipped: number;
  failed: number;
  nextCursor?: string | null;
  hasMore: boolean;
};

const META: Record<DealerType, { label: string; description: string; color: string; glyph: MapMarker["glyph"]; icon: "store" | "settings" | "wrench" }> = {
  commercial: { label: "Đại lý thương mại", description: "Bán hàng, không làm dịch vụ kỹ thuật", color: "#eab308", glyph: "store", icon: "store" },
  service: { label: "Đại lý dịch vụ", description: "Có kỹ thuật viên bảo hành, sửa chữa", color: "#16a34a", glyph: "wrench", icon: "settings" },
  freelancer: { label: "CTV / Thợ tự do", description: "Màu marker theo năng lực chính (đầu tiên theo ABC)", color: "#dc2626", glyph: "user", icon: "wrench" },
};

const CAPABILITY_COLORS = ["#dc2626", "#7c3aed", "#ea580c", "#0891b2", "#db2777", "#4f46e5", "#0f766e", "#b45309"];

function normalize(value?: string | null) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

function typeOf(dealer: Dealer): DealerType {
  const registration = normalize(dealer.registrationType);
  if (/collaborator|cong tac|freelancer|\bctv\b|tho tu do/.test(registration)) return "freelancer";
  if (/commercial|thuong mai/.test(registration)) return "commercial";
  if (/service|dich vu|uy quyen/.test(registration)) return "service";
  if (/ctv/.test(normalize(dealer.dealerCode))) return "freelancer";
  return (dealer.technicianCount || 0) > 0 ? "service" : "commercial";
}

function serviceList(dealer: Dealer) {
  return (dealer.services || "").split(",").map((value) => value.trim()).filter(Boolean);
}

function colorFromText(value: string) {
  const normalized = normalize(value);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  return CAPABILITY_COLORS[Math.abs(hash) % CAPABILITY_COLORS.length];
}

function markerColor(dealer: Dealer) {
  const kind = typeOf(dealer);
  if (kind !== "freelancer") return META[kind].color;
  const primaryCapability = serviceList(dealer).slice().sort((a, b) => a.localeCompare(b, "vi"))[0];
  return primaryCapability ? colorFromText(primaryCapability) : META.freelancer.color;
}

function hasUsableCoordinates(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "—";
}

export default function DealerMapPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<DealerType | "">("");
  const [province, setProvince] = useState("");
  const [capability, setCapability] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncingGps, setSyncingGps] = useState(false);
  const [forceGpsRefresh, setForceGpsRefresh] = useState(false);
  const [gpsNotice, setGpsNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [gpsProgress, setGpsProgress] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dealers/map", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được đại lý.");
      setDealers(result.data || []);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function syncGps() {
    if (forceGpsRefresh && !window.confirm("Cập nhật lại GPS cho cả các đại lý đã có tọa độ? Hãy dùng tùy chọn này khi nghi GPS cũ đang sai.")) return;
    setSyncingGps(true);
    setGpsNotice(null);
    setGpsProgress("Đang bắt đầu cập nhật vị trí...");
    setError("");
    let cursor: string | null = null;
    const totals = { scanned: 0, attempted: 0, updated: 0, skipped: 0, failed: 0 };
    try {
      do {
        const response = await fetch("/api/dealers/geocode-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cursor, force: forceGpsRefresh }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được vị trí.");
        const batch = result.data as GpsSyncBatch;
        totals.scanned += batch.scanned || 0;
        totals.attempted += batch.attempted || 0;
        totals.updated += batch.updated || 0;
        totals.skipped += batch.skipped || 0;
        totals.failed += batch.failed || 0;
        cursor = batch.nextCursor || null;
        setGpsProgress(`Đã kiểm tra ${totals.scanned} hồ sơ · cập nhật ${totals.updated} vị trí · chưa xác định ${totals.failed}`);
      } while (cursor);
      setSelectedId(null);
      await load();
      const text = totals.failed > 0
        ? `Đã cập nhật ${totals.updated}/${totals.attempted} hồ sơ. Còn ${totals.failed} hồ sơ chưa xác định được vị trí; vui lòng kiểm tra lại địa chỉ.`
        : `Hoàn tất cập nhật vị trí cho ${totals.updated}/${totals.attempted} hồ sơ.`;
      setGpsNotice({ kind: totals.failed > 0 ? "error" : "success", text });
    } catch (value) {
      setGpsNotice({ kind: "error", text: value instanceof Error ? value.message : "Không cập nhật được vị trí đại lý." });
    } finally {
      setSyncingGps(false);
      setGpsProgress("");
    }
  }

  const provinces = useMemo(() => [...new Set(dealers.map((dealer) => dealer.province).filter(Boolean) as string[])].sort(), [dealers]);
  const capabilities = useMemo(() => [...new Set(dealers.flatMap(serviceList))].sort((a, b) => a.localeCompare(b, "vi")), [dealers]);
  const filtered = useMemo(() => dealers.filter((dealer) => {
    const text = `${dealer.dealerCode} ${dealer.name} ${dealer.companyName || ""} ${dealer.representativeName || ""} ${dealer.phone} ${dealer.services || ""} ${dealer.address || ""}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!kind || typeOf(dealer) === kind) && (!province || dealer.province === province) && (!capability || serviceList(dealer).includes(capability));
  }), [dealers, search, kind, province, capability]);

  const located = filtered.filter((dealer) => hasUsableCoordinates(dealer.lat, dealer.lng));
  const missingGpsCount = dealers.filter((dealer) => !hasUsableCoordinates(dealer.lat, dealer.lng)).length;
  const addressReadyCount = dealers.filter((dealer) => dealer.address?.trim() && !hasUsableCoordinates(dealer.lat, dealer.lng)).length;
  const selected = dealers.find((dealer) => dealer.id === selectedId) || null;
  const markers: MapMarker[] = located.map((dealer) => {
    const meta = META[typeOf(dealer)];
    return {
      id: dealer.id,
      lat: dealer.lat!,
      lng: dealer.lng!,
      title: dealer.companyName || dealer.name,
      subtitle: `${dealer.representativeName || dealer.name} · ${dealer.phone}`,
      color: markerColor(dealer),
      glyph: meta.glyph,
    };
  });

  return <main className="min-h-screen bg-slate-50/70">
    <OperationsHeader title="Bản đồ mạng lưới đại lý" subtitle="Vàng: thương mại · Xanh: đại lý dịch vụ · CTV/thợ: màu theo năng lực chính" actions={<button type="button" onClick={load} disabled={syncingGps} className="icon-button disabled:opacity-50" title="Tải lại"><Icon name="refresh" size={18}/></button>} />
    <section className="mx-auto max-w-[1480px] space-y-4 p-3 sm:p-5">
      {error && <Notice kind="error">{error}</Notice>}
      {gpsNotice && <Notice kind={gpsNotice.kind}>{gpsNotice.text}</Notice>}

      <div className="surface-card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon name="map-pin" size={19}/></span><div><h2 className="font-black text-slate-950">Cập nhật vị trí từ địa chỉ cho toàn bộ đại lý</h2><p className="mt-0.5 text-sm text-slate-500">Hệ thống tự xác định vị trí cho hồ sơ đã có địa chỉ nhưng chưa có tọa độ.</p></div></div><p className="mt-3 text-xs font-bold text-slate-600">{missingGpsCount} hồ sơ chưa có vị trí hợp lệ · {addressReadyCount} hồ sơ có thể tự định vị</p></div>
        <div className="flex shrink-0 flex-col gap-2 sm:min-w-[340px]"><label className="inline-flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={forceGpsRefresh} onChange={(event) => setForceGpsRefresh(event.target.checked)} disabled={syncingGps} className="mt-0.5"/><span>Cập nhật lại cả vị trí đã có khi nghi tọa độ cũ chưa chính xác</span></label><button type="button" onClick={syncGps} disabled={syncingGps || (!forceGpsRefresh && addressReadyCount === 0)} className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3 font-black text-white disabled:opacity-50"><Icon name="refresh" size={17} className={syncingGps ? "animate-spin" : ""}/>{syncingGps ? "Đang cập nhật vị trí..." : "Cập nhật vị trí từ địa chỉ"}</button>{gpsProgress && <p className="text-center text-xs font-bold text-emerald-700">{gpsProgress}</p>}</div>
      </div>

      <div className="grid gap-3 surface-card p-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_220px_260px_auto]">
        <label className="relative"><Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã, công ty, người đại diện, SĐT hoặc địa chỉ" className="pl-11"/></label>
        <select value={province} onChange={(event) => setProvince(event.target.value)}><option value="">Tất cả tỉnh</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={kind} onChange={(event) => setKind(event.target.value as DealerType | "")}><option value="">Tất cả nhóm</option>{(Object.keys(META) as DealerType[]).map((key) => <option key={key} value={key}>{META[key].label}</option>)}</select>
        <select value={capability} onChange={(event) => setCapability(event.target.value)}><option value="">Tất cả năng lực sửa chữa</option>{capabilities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <button type="button" onClick={() => { setSearch(""); setProvince(""); setKind(""); setCapability(""); }} className="btn-secondary"><Icon name="x" size={17}/> Xóa lọc</button>
      </div>

      <div className="surface-card flex flex-wrap items-center gap-2 px-4 py-3 text-xs text-slate-600"><strong className="mr-1 text-slate-800">Màu CTV theo năng lực chính:</strong>{capabilities.slice(0, 8).map((item) => <button type="button" key={item} onClick={() => setCapability(capability === item ? "" : item)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colorFromText(item) }}/>{item}</button>)}</div>
      <div className="text-xs text-slate-500"><span>{filtered.length} đại lý phù hợp · {located.length} có vị trí trên bản đồ</span></div>

      <div className="grid gap-3 sm:grid-cols-3">{(Object.keys(META) as DealerType[]).map((key) => <button type="button" key={key} onClick={() => setKind(kind === key ? "" : key)} className={`metric-card text-left ${kind === key ? "ring-2 ring-emerald-500" : ""}`}><span className="metric-icon" style={{ color: META[key].color, background: `${META[key].color}18` }}><Icon name={META[key].icon}/></span><div><p className="metric-label">{META[key].label}</p><p className="metric-value">{dealers.filter((dealer) => typeOf(dealer) === key).length}</p><p className="mt-1 text-xs text-slate-500">{META[key].description}</p></div></button>)}</div>

      {loading ? <LoadingState label="Đang tải mạng lưới đại lý..."/> : <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <InteractiveMap markers={markers} activeId={selectedId} onSelect={setSelectedId} height={710}/>
        <aside className="surface-card min-h-[320px] p-5 xl:h-[710px] xl:overflow-y-auto">{selected ? <DealerDetail dealer={selected} onClose={() => setSelectedId(null)}/> : <div className="flex h-full min-h-[300px] flex-col justify-center text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon name="store" size={30}/></span><h2 className="mt-4 text-xl font-extrabold">Chọn một đại lý / CTV</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">Xem công ty, người đại diện, ngày sinh, số KTV, khu vực và toàn bộ năng lực kỹ thuật.</p><p className="mx-auto mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"><strong>{missingGpsCount}</strong> đại lý chưa có vị trí hợp lệ trên bản đồ.</p></div>}</aside>
      </div>}
    </section>
  </main>;
}

function DealerDetail({ dealer, onClose }: { dealer: Dealer; onClose: () => void }) {
  const meta = META[typeOf(dealer)];
  const capabilities = serviceList(dealer);
  const displayName = dealer.companyName || dealer.name;
  const representative = dealer.representativeName || (dealer.companyName ? dealer.name : null);
  return <div>
    <div className="flex items-start justify-between gap-3"><div><span className="status-pill" style={{ color: meta.color, background: `${meta.color}18` }}>{meta.label}</span><h2 className="mt-3 text-xl font-extrabold">{displayName}</h2><p className="mt-1 text-sm font-bold text-blue-700">{dealer.dealerCode}</p>{representative && <p className="mt-1 text-sm text-slate-500">Đại diện: <strong className="text-slate-700">{representative}</strong></p>}</div><button type="button" className="icon-button" onClick={onClose}><Icon name="x" size={18}/></button></div>

    <div className="mt-5 space-y-4">
      <Info icon="building" label="Công ty / tổ chức" value={dealer.companyName || dealer.name || "—"}/>
      <Info icon="user" label="Đại lý / Họ tên CTV" value={dealer.representativeName || dealer.name || "—"}/>
      <Info icon="phone" label="Số điện thoại" value={dealer.phone}/>
      <Info icon="calendar" label="Ngày sinh" value={formatDate(dealer.birthDate)}/>
      <Info icon="map-pin" label="Địa chỉ" value={[dealer.address, dealer.province].filter(Boolean).join(", ") || "—"}/>
      <Info icon="users" label="Số lượng KTV" value={`${dealer.technicianCount || 0} người`}/>
      <Info icon="wrench" label="Loại địa điểm / khu vực phục vụ" value={[dealer.locationType, dealer.serviceArea].filter(Boolean).join(" · ") || "—"}/>
      <Info icon="star" label="Đánh giá" value={`${dealer.rating ?? 5}/5`}/>
    </div>

    <div className="mt-5"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Các dịch vụ có thể đảm nhiệm</p>{capabilities.length ? <div className="mt-2 flex flex-wrap gap-2">{capabilities.map((item) => <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colorFromText(item) }}/>{item}</span>)}</div> : <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Không nhận dịch vụ kỹ thuật.</p>}</div>

    <div className="mt-5 grid grid-cols-3 gap-2">{[[dealer.portraitPhoto, "Chân dung"], [dealer.storePhoto, "Cửa hàng"], [dealer.warehousePhoto, "Kho"]].map(([url, label]) => url ? <a key={label} href={url as string} target="_blank" rel="noreferrer" className="btn-secondary justify-center px-2 text-xs"><Icon name="camera" size={15}/>{label}</a> : null)}</div>
    <a href={`tel:${dealer.phone}`} className="btn-primary mt-5 flex items-center justify-center gap-2 px-4 py-3 font-bold text-white"><Icon name="phone" size={18}/> Gọi đại lý / CTV</a>
  </div>;
}

function Info({ icon, label, value }: { icon: "building" | "user" | "phone" | "calendar" | "map-pin" | "users" | "star" | "wrench"; label: string; value: string }) {
  return <div className="flex gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon name={icon} size={17}/></span><div className="min-w-0"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value}</p></div></div>;
}
