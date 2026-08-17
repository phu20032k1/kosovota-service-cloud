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
  phone: string;
  address?: string | null;
  province?: string | null;
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

const META: Record<DealerType, { label: string; description: string; color: string; glyph: MapMarker["glyph"]; icon: "store" | "settings" | "wrench" }> = {
  commercial: {
    label: "Đại lý thương mại",
    description: "Bán hàng, không làm dịch vụ kỹ thuật",
    color: "#eab308",
    glyph: "store",
    icon: "store",
  },
  service: {
    label: "Đại lý dịch vụ",
    description: "Có kỹ thuật viên bảo hành, sửa chữa",
    color: "#16a34a",
    glyph: "wrench",
    icon: "settings",
  },
  freelancer: {
    label: "CTV / Thợ tự do",
    description: "Điều phối theo năng lực sửa chữa",
    color: "#dc2626",
    glyph: "user",
    icon: "wrench",
  },
};

function normalize(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
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
  return (dealer.services || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dealers", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được đại lý.");
      setDealers((result.data || []).filter((dealer: Dealer) => dealer.status === "APPROVED"));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const provinces = useMemo(
    () => [...new Set(dealers.map((dealer) => dealer.province).filter(Boolean) as string[])].sort(),
    [dealers],
  );

  const capabilities = useMemo(
    () => [...new Set(dealers.flatMap(serviceList))].sort((a, b) => a.localeCompare(b, "vi")),
    [dealers],
  );

  const filtered = useMemo(
    () =>
      dealers.filter((dealer) => {
        const text = `${dealer.dealerCode} ${dealer.name} ${dealer.phone} ${dealer.services || ""} ${dealer.address || ""}`.toLowerCase();
        const matchesCapability = !capability || serviceList(dealer).includes(capability);
        return (
          (!search || text.includes(search.toLowerCase())) &&
          (!kind || typeOf(dealer) === kind) &&
          (!province || dealer.province === province) &&
          matchesCapability
        );
      }),
    [dealers, search, kind, province, capability],
  );

  const located = filtered.filter((dealer) => dealer.lat != null && dealer.lng != null);
  const selected = dealers.find((dealer) => dealer.id === selectedId) || null;
  const markers: MapMarker[] = located.map((dealer) => {
    const meta = META[typeOf(dealer)];
    return {
      id: dealer.id,
      lat: dealer.lat!,
      lng: dealer.lng!,
      title: dealer.name,
      subtitle: `${dealer.dealerCode} · ${dealer.phone}`,
      color: meta.color,
      glyph: meta.glyph,
    };
  });

  return (
    <main className="min-h-screen bg-slate-50/70">
      <OperationsHeader
        title="Bản đồ mạng lưới đại lý"
        subtitle="3 màu năng lực: Vàng thương mại · Xanh dịch vụ · Đỏ CTV/thợ tự do"
        actions={
          <button type="button" onClick={load} className="icon-button" title="Tải lại">
            <Icon name="refresh" size={18} />
          </button>
        }
      />
      <section className="mx-auto max-w-[1480px] space-y-4 p-3 sm:p-5">
        {error && <Notice kind="error">{error}</Notice>}

        <div className="grid gap-3 surface-card p-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_220px_260px_auto]">
          <label className="relative">
            <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã, tên, SĐT hoặc địa chỉ"
              className="pl-11"
            />
          </label>
          <select value={province} onChange={(event) => setProvince(event.target.value)}>
            <option value="">Tất cả tỉnh</option>
            {provinces.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select value={kind} onChange={(event) => setKind(event.target.value as DealerType | "")}>
            <option value="">Tất cả nhóm</option>
            {(Object.keys(META) as DealerType[]).map((key) => (
              <option key={key} value={key}>
                {META[key].label}
              </option>
            ))}
          </select>
          <select value={capability} onChange={(event) => setCapability(event.target.value)}>
            <option value="">Tất cả năng lực sửa chữa</option>
            {capabilities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setProvince("");
              setKind("");
              setCapability("");
            }}
            className="btn-secondary"
          >
            <Icon name="x" size={17} /> Xóa lọc
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(META) as DealerType[]).map((key) => (
            <button
              type="button"
              key={key}
              onClick={() => setKind(kind === key ? "" : key)}
              className={`metric-card text-left ${kind === key ? "ring-2 ring-emerald-500" : ""}`}
            >
              <span className="metric-icon" style={{ color: META[key].color, background: `${META[key].color}18` }}>
                <Icon name={META[key].icon} />
              </span>
              <div>
                <p className="metric-label">{META[key].label}</p>
                <p className="metric-value">{dealers.filter((dealer) => typeOf(dealer) === key).length}</p>
                <p className="mt-1 text-xs text-slate-500">{META[key].description}</p>
              </div>
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState label="Đang tải mạng lưới đại lý..." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
            <InteractiveMap markers={markers} activeId={selectedId} onSelect={setSelectedId} height={690} />
            <aside className="surface-card min-h-[320px] p-5 xl:h-[690px] xl:overflow-y-auto">
              {selected ? (
                <DealerDetail dealer={selected} onClose={() => setSelectedId(null)} />
              ) : (
                <div className="flex h-full min-h-[300px] flex-col justify-center text-center">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                    <Icon name="store" size={30} />
                  </span>
                  <h2 className="mt-4 text-xl font-extrabold">Chọn một đại lý</h2>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                    Xem nhóm năng lực, kỹ năng, số kỹ thuật viên, rating, ảnh cơ sở và gọi trực tiếp.
                  </p>
                  <p className="mx-auto mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    <strong>{dealers.filter((dealer) => dealer.lat == null || dealer.lng == null).length}</strong> đại lý chưa có tọa độ GPS.
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

function DealerDetail({ dealer, onClose }: { dealer: Dealer; onClose: () => void }) {
  const meta = META[typeOf(dealer)];
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="status-pill" style={{ color: meta.color, background: `${meta.color}18` }}>
            {meta.label}
          </span>
          <h2 className="mt-3 text-xl font-extrabold">{dealer.name}</h2>
          <p className="mt-1 text-sm font-bold text-blue-700">{dealer.dealerCode}</p>
        </div>
        <button type="button" className="icon-button" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <div className="mt-5 space-y-4">
        <Info icon="phone" label="Số điện thoại" value={dealer.phone} />
        <Info icon="map-pin" label="Địa chỉ" value={[dealer.address, dealer.province].filter(Boolean).join(", ") || "—"} />
        <Info icon="users" label="Kỹ thuật viên" value={`${dealer.technicianCount || 0} người`} />
        <Info icon="star" label="Đánh giá" value={`${dealer.rating ?? 5}/5`} />
        <Info icon="wrench" label="Năng lực" value={dealer.services || "Không làm dịch vụ kỹ thuật"} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          [dealer.portraitPhoto, "Chân dung"],
          [dealer.storePhoto, "Cửa hàng"],
          [dealer.warehousePhoto, "Kho"],
        ].map(([url, label]) =>
          url ? (
            <a key={label} href={url as string} target="_blank" className="btn-secondary px-2 text-xs">
              <Icon name="camera" size={15} />
              {label}
            </a>
          ) : null,
        )}
      </div>
      <a href={`tel:${dealer.phone}`} className="btn-primary mt-5 flex items-center justify-center gap-2 px-4 py-3 font-bold text-white">
        <Icon name="phone" size={18} /> Gọi đại lý
      </a>
    </div>
  );
}

function Info({ icon, label, value }: { icon: "phone" | "map-pin" | "users" | "star" | "wrench"; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
        <Icon name={icon} size={17} />
      </span>
      <div>
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
